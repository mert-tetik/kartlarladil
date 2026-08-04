export type DialogueVideoScene = {
  text: string;
  translation?: string;
  character: 1 | 2;
  audioDataUrl: string;
};

type DialogueVideoRenderOptions = {
  audioContext: AudioContext;
  backgroundVideoUrl: string;
  firstCharacter: string;
  secondCharacter: string;
  scenes: readonly DialogueVideoScene[];
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const DETERMINISTIC_FRAME_RATE = 30;
const DETERMINISTIC_VIDEO_BITRATE = 4_500_000;
const DETERMINISTIC_AUDIO_BITRATE = 128_000;
const SCENE_GAP_SECONDS = 0.22;
const SUBTITLE_MAX_WIDTH = 900;
const CHARACTER_ENTER_SECONDS = 0.82;
const CHARACTER_EXIT_SECONDS = 0.62;
const CHARACTER_SCALE = 1.65;
const CHARACTER_STAGE_CENTER_Y = 1380;
const CHARACTER_SIDE_INSET = -92;
const DIALOGUE_SUBTITLE_FONT = '"Avenir Next", "Helvetica Neue", Manrope, Arial, sans-serif';

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("video_asset_load_failed"));
    image.src = source;
  });
}

function loadBackgroundVideo(source: string) {
  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error("dialogue_background_load_failed"));
    video.src = source;
    video.load();
  });
}

function recorderMimeType() {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function easeOutQuint(value: number) {
  return 1 - (1 - Math.max(0, Math.min(1, value))) ** 5;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

function drawSubtitles(context: CanvasRenderingContext2D, scene: DialogueVideoScene) {
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 76px ${DIALOGUE_SUBTITLE_FONT}`;
  const primary = wrapText(context, scene.text, SUBTITLE_MAX_WIDTH);
  const translation = scene.translation?.trim() ? wrapText(context, scene.translation, SUBTITLE_MAX_WIDTH) : [];
  const primaryLineHeight = 90;
  const translationLineHeight = 62;
  const totalHeight = primary.length * primaryLineHeight + (translation.length ? 26 + translation.length * translationLineHeight : 0);
  let y = 320 - totalHeight / 2 + primaryLineHeight / 2;
  context.lineJoin = "round";
  context.lineWidth = 3;
  context.strokeStyle = "rgba(0, 0, 0, 0.88)";
  context.fillStyle = "#ffffff";
  primary.forEach((line) => {
    context.strokeText(line, CANVAS_WIDTH / 2, y);
    context.fillText(line, CANVAS_WIDTH / 2, y);
    y += primaryLineHeight;
  });
  if (translation.length) {
    y += 13;
    context.fillStyle = "#f76808";
    context.font = `700 50px ${DIALOGUE_SUBTITLE_FONT}`;
    translation.forEach((line) => {
      context.fillText(line, CANVAS_WIDTH / 2, y);
      y += translationLineHeight;
    });
  }
}

function drawBackgroundOverlay(context: CanvasRenderingContext2D) {
  const overlay = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  overlay.addColorStop(0, "rgba(0, 0, 0, 0.74)");
  overlay.addColorStop(0.42, "rgba(0, 0, 0, 0.42)");
  overlay.addColorStop(1, "rgba(0, 0, 0, 0.68)");
  context.fillStyle = overlay;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawBackground(context: CanvasRenderingContext2D, video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("dialogue_background_load_failed");
  const scale = Math.max(CANVAS_WIDTH / sourceWidth, CANVAS_HEIGHT / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.drawImage(video, (CANVAS_WIDTH - width) / 2, (CANVAS_HEIGHT - height) / 2, width, height);
  drawBackgroundOverlay(context);
}

function drawDecodedBackground(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement | OffscreenCanvas) {
  context.drawImage(canvas, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackgroundOverlay(context);
}

type CharacterMotion = {
  active: boolean;
  entering: number;
  exiting: number;
};

function getCharacterMotion(
  character: 1 | 2,
  scenes: readonly DialogueVideoScene[],
  starts: readonly number[],
  durationSeconds: number,
  sceneIndex: number,
  elapsed: number,
): CharacterMotion | null {
  const activeScene = scenes[sceneIndex];
  if (!activeScene) return null;
  const activeTurnEnd = (starts[sceneIndex + 1] ?? durationSeconds - 0.3) - SCENE_GAP_SECONDS;
  if (activeScene.character === character) {
    if (elapsed <= activeTurnEnd) {
      return { active: true, entering: (elapsed - starts[sceneIndex]!) / CHARACTER_ENTER_SECONDS, exiting: 0 };
    }
    return { active: false, entering: 1, exiting: (elapsed - activeTurnEnd) / CHARACTER_EXIT_SECONDS };
  }

  const previousSceneIndex = sceneIndex - 1;
  if (previousSceneIndex < 0 || scenes[previousSceneIndex]?.character !== character) return null;
  const previousTurnEnd = starts[sceneIndex]! - SCENE_GAP_SECONDS;
  const exiting = (elapsed - previousTurnEnd) / CHARACTER_EXIT_SECONDS;
  return exiting < 1 ? { active: false, entering: 1, exiting } : null;
}

function drawCharacter(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  motion: CharacterMotion,
  activeProgress: number,
  side: "left" | "right",
) {
  const maxWidth = 480 * CHARACTER_SCALE;
  const maxHeight = 800 * CHARACTER_SCALE;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const targetX = side === "left" ? CHARACTER_SIDE_INSET : CANVAS_WIDTH - width - CHARACTER_SIDE_INSET;
  const targetY = CHARACTER_STAGE_CENTER_Y - height / 2;
  const startY = CANVAS_HEIGHT + 90;
  const entering = easeOutQuint(motion.entering);
  const visible = motion.exiting > 0 ? 1 - easeOutQuint(motion.exiting) : entering;
  if (visible <= 0) return;
  const talkingLift = motion.active ? Math.sin(Math.min(1, activeProgress / 0.44) * Math.PI) * 18 : 0;
  const y = startY + (targetY - startY) * visible - talkingLift;
  context.save();
  context.globalAlpha = motion.active ? Math.min(1, 0.3 + visible * 0.7) : Math.min(0.96, visible * 0.96);
  context.drawImage(image, targetX, y, width, height);
  context.restore();
}

/** Browser-only 9:16 dialogue renderer. Each speaker rises from below the frame on their turn. */
async function renderRealtimeDialogueVideo({ audioContext, backgroundVideoUrl, firstCharacter, secondCharacter, scenes }: DialogueVideoRenderOptions) {
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") throw new Error("video_not_supported");
  if (!scenes.length || scenes.length > 10) throw new Error("invalid_dialogue_scene_count");

  const [backgroundVideo, firstImage, secondImage] = await Promise.all([
    loadBackgroundVideo(backgroundVideoUrl),
    loadImage(`/mascot-variations/${encodeURIComponent(firstCharacter)}`),
    loadImage(`/mascot-variations/${encodeURIComponent(secondCharacter)}`),
  ]);
  const audioBuffers = await Promise.all(scenes.map(async (scene) => {
    const response = await fetch(scene.audioDataUrl);
    if (!response.ok) throw new Error("speech_load_failed");
    return await audioContext.decodeAudioData(await response.arrayBuffer());
  }));
  const starts: number[] = [];
  let elapsedSeconds = 0;
  audioBuffers.forEach((buffer) => {
    starts.push(elapsedSeconds);
    elapsedSeconds += buffer.duration + SCENE_GAP_SECONDS;
  });
  const durationSeconds = elapsedSeconds - SCENE_GAP_SECONDS + 0.3;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  // A detached canvas can leave MediaRecorder with a stale frame while Web
  // Audio continues normally. Keep the implementation surface in the DOM for
  // the complete capture, but entirely outside the visible studio UI.
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;pointer-events:none;opacity:0";
  document.body.append(canvas);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_not_supported");

  // Keep the muted source attached while rendering so browser decoders continue
  // advancing it frame by frame during the off-screen Canvas capture.
  backgroundVideo.setAttribute("aria-hidden", "true");
  backgroundVideo.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;pointer-events:none;opacity:0";
  document.body.append(backgroundVideo);

  const destination = audioContext.createMediaStreamDestination();
  const videoStream = canvas.captureStream(30);
  const stream = new MediaStream([...videoStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
  const mimeType = recorderMimeType();
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_500_000 }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  const completed = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error("recording_failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });

  const startTime = audioContext.currentTime + 0.08;
  audioBuffers.forEach((buffer, index) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    source.start(startTime + starts[index]!);
  });

  let renderTimer: number | null = null;
  const drawFrame = () => {
    const elapsed = Math.min(durationSeconds, Math.max(0, audioContext.currentTime - startTime));
    const sceneIndex = starts.reduce((active, start, index) => start <= elapsed ? index : active, 0);
    const scene = scenes[sceneIndex]!;
    const localElapsed = Math.max(0, elapsed - starts[sceneIndex]!);
    drawBackground(context, backgroundVideo);
    drawSubtitles(context, scene);
    const firstMotion = getCharacterMotion(1, scenes, starts, durationSeconds, sceneIndex, elapsed);
    const secondMotion = getCharacterMotion(2, scenes, starts, durationSeconds, sceneIndex, elapsed);
    if (firstMotion) drawCharacter(context, firstImage, firstMotion, localElapsed, "left");
    if (secondMotion) drawCharacter(context, secondImage, secondMotion, localElapsed, "right");
  };

  await backgroundVideo.play().catch(() => { throw new Error("dialogue_background_playback_failed"); });
  recorder.start(250);
  drawFrame();
  // Render at a fixed cadence. requestAnimationFrame may be suspended while
  // the browser continues the already-scheduled Web Audio dialogue.
  renderTimer = window.setInterval(drawFrame, 1000 / 30);
  window.setTimeout(() => {
    if (renderTimer !== null) window.clearInterval(renderTimer);
    drawFrame();
    if (recorder.state !== "inactive") recorder.stop();
  }, (durationSeconds + 0.12) * 1000);

  try {
    return await completed;
  } finally {
    if (renderTimer !== null) window.clearInterval(renderTimer);
    stream.getTracks().forEach((track) => track.stop());
    destination.disconnect();
    backgroundVideo.pause();
    backgroundVideo.removeAttribute("src");
    backgroundVideo.load();
    backgroundVideo.remove();
    canvas.remove();
    await audioContext.close();
  }
}

function getDialogueTiming(audioBuffers: readonly AudioBuffer[], scenes: readonly DialogueVideoScene[]) {
  const starts: number[] = [];
  let elapsedSeconds = 0;
  audioBuffers.forEach((buffer) => {
    starts.push(elapsedSeconds);
    elapsedSeconds += buffer.duration + SCENE_GAP_SECONDS;
  });
  const durationSeconds = elapsedSeconds - SCENE_GAP_SECONDS + 0.3;
  return { starts, durationSeconds };
}

async function decodeDialogueAudio(audioContext: AudioContext, scenes: readonly DialogueVideoScene[]) {
  return await Promise.all(scenes.map(async (scene) => {
    const response = await fetch(scene.audioDataUrl);
    if (!response.ok) throw new Error("speech_load_failed");
    return await audioContext.decodeAudioData(await response.arrayBuffer());
  }));
}

async function renderOfflineDialogueAudio(audioBuffers: readonly AudioBuffer[], starts: readonly number[], durationSeconds: number) {
  const sampleRate = 48_000;
  const offlineContext = new OfflineAudioContext(2, Math.ceil(durationSeconds * sampleRate), sampleRate);
  audioBuffers.forEach((buffer, index) => {
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start(starts[index]!);
  });
  return await offlineContext.startRendering();
}

async function canRenderDialogueDeterministically() {
  if (typeof OfflineAudioContext === "undefined") return false;
  try {
    return await canEncodeVideo("vp8", {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      bitrate: DETERMINISTIC_VIDEO_BITRATE,
    }) && await canEncodeAudio("opus", {
      numberOfChannels: 2,
      sampleRate: 48_000,
      bitrate: DETERMINISTIC_AUDIO_BITRATE,
    });
  } catch {
    return false;
  }
}

async function renderDeterministicDialogueVideo({ audioContext, backgroundVideoUrl, firstCharacter, secondCharacter, scenes }: DialogueVideoRenderOptions) {
  const [backgroundResponse, firstImage, secondImage, audioBuffers] = await Promise.all([
    fetch(backgroundVideoUrl),
    loadImage(`/mascot-variations/${encodeURIComponent(firstCharacter)}`),
    loadImage(`/mascot-variations/${encodeURIComponent(secondCharacter)}`),
    decodeDialogueAudio(audioContext, scenes),
  ]);
  if (!backgroundResponse.ok) throw new Error("dialogue_background_load_failed");

  const backgroundInput = new Input({
    source: new BlobSource(await backgroundResponse.blob()),
    formats: ALL_FORMATS,
  });

  try {
    const backgroundTrack = await backgroundInput.getPrimaryVideoTrack();
    const backgroundDuration = await backgroundInput.computeDuration();
    if (!backgroundTrack || !Number.isFinite(backgroundDuration) || backgroundDuration <= 0) {
      throw new Error("dialogue_background_load_failed");
    }

    const { starts, durationSeconds } = getDialogueTiming(audioBuffers, scenes);
    const frameCount = Math.ceil(durationSeconds * DETERMINISTIC_FRAME_RATE);
    const frameDuration = 1 / DETERMINISTIC_FRAME_RATE;
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_not_supported");

    const backgroundSink = new CanvasSink(backgroundTrack, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fit: "cover",
      poolSize: 2,
    });
    const target = new BufferTarget();
    const output = new Output({ format: new WebMOutputFormat(), target });
    const videoSource = new CanvasSource(canvas, {
      codec: "vp8",
      bitrate: DETERMINISTIC_VIDEO_BITRATE,
      keyFrameInterval: 2,
    });
    const audioSource = new AudioBufferSource({
      codec: "opus",
      bitrate: DETERMINISTIC_AUDIO_BITRATE,
    });
    output.addVideoTrack(videoSource, { maximumPacketCount: frameCount });
    output.addAudioTrack(audioSource);
    await output.start();

    const mixedAudio = await renderOfflineDialogueAudio(audioBuffers, starts, frameCount * frameDuration);
    await audioSource.add(mixedAudio);

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const elapsed = frameIndex * frameDuration;
      const backgroundFrame = await backgroundSink.getCanvas(elapsed % backgroundDuration);
      if (!backgroundFrame) throw new Error("dialogue_background_frame_unavailable");
      const sceneIndex = starts.reduce((active, start, index) => start <= elapsed ? index : active, 0);
      const scene = scenes[sceneIndex]!;
      const localElapsed = Math.max(0, elapsed - starts[sceneIndex]!);
      drawDecodedBackground(context, backgroundFrame.canvas);
      drawSubtitles(context, scene);
      const firstMotion = getCharacterMotion(1, scenes, starts, durationSeconds, sceneIndex, elapsed);
      const secondMotion = getCharacterMotion(2, scenes, starts, durationSeconds, sceneIndex, elapsed);
      if (firstMotion) drawCharacter(context, firstImage, firstMotion, localElapsed, "left");
      if (secondMotion) drawCharacter(context, secondImage, secondMotion, localElapsed, "right");
      await videoSource.add(elapsed, frameDuration, { keyFrame: frameIndex % (DETERMINISTIC_FRAME_RATE * 2) === 0 });
    }

    await output.finalize();
    if (!target.buffer) throw new Error("deterministic_recording_failed");
    return new Blob([target.buffer], { type: await output.getMimeType() });
  } finally {
    backgroundInput.dispose();
  }
}

/**
 * Frame-exact dialogue export for Chrome/Android. Rendering proceeds frame by
 * frame rather than in real time, so slow devices take longer to export but do
 * not skip dialogue animation frames. Older browsers retain MediaRecorder.
 */
export async function renderDialogueVideo(options: DialogueVideoRenderOptions) {
  try {
    if (await canRenderDialogueDeterministically()) {
      try {
        return await renderDeterministicDialogueVideo(options);
      } catch (error) {
        // Some Chrome/Android builds can encode VP8 but cannot WebCodecs-decode
        // the selected MP4 background. Keep the deterministic route as the
        // default, then use Chrome's proven HTML video decoder when that exact
        // device cannot complete it.
        console.warn("Frame-exact dialogue export was unavailable; using the compatibility renderer.", error);
      }
    }
    return await renderRealtimeDialogueVideo(options);
  } finally {
    if (options.audioContext.state !== "closed") await options.audioContext.close();
  }
}
import { ALL_FORMATS, AudioBufferSource, BlobSource, BufferTarget, CanvasSink, CanvasSource, canEncodeAudio, canEncodeVideo, Input, Output, WebMOutputFormat } from "mediabunny";
