import { releaseMusicVideoAudioContext } from "@/features/twitter-automation/automation-music-video-audio-session";
import { AudioBufferSource, BufferTarget, CanvasSource, canEncodeAudio, canEncodeVideo, Output, WebMOutputFormat } from "mediabunny";

export type DialogueVideoScene = {
  text: string;
  translation?: string;
  character: 1 | 2;
  audioDataUrl: string;
};

type DialogueVideoRenderOptions = {
  audioContext: BaseAudioContext;
  backgroundVideoUrl: string;
  backgroundVideoPath?: string;
  firstCharacter: string;
  secondCharacter: string;
  scenes: readonly DialogueVideoScene[];
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const DETERMINISTIC_FRAME_RATE = 24;
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

const subtitleCache = new Map<string, HTMLCanvasElement>();

function getSubtitleCacheKey(scene: DialogueVideoScene) {
  return `${scene.text}|${scene.translation ?? ""}`;
}

function renderSubtitlesToCache(scene: DialogueVideoScene) {
  const key = getSubtitleCacheKey(scene);
  const cached = subtitleCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = 640;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_not_supported");
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
  subtitleCache.set(key, canvas);
  return canvas;
}

function drawSubtitles(context: CanvasRenderingContext2D, scene: DialogueVideoScene) {
  const cached = renderSubtitlesToCache(scene);
  context.drawImage(cached, 0, 0);
}

let cachedOverlayCanvas: HTMLCanvasElement | null = null;

function getOverlayCanvas() {
  if (cachedOverlayCanvas) return cachedOverlayCanvas;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_not_supported");
  const overlay = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  overlay.addColorStop(0, "rgba(0, 0, 0, 0.74)");
  overlay.addColorStop(0.42, "rgba(0, 0, 0, 0.42)");
  overlay.addColorStop(1, "rgba(0, 0, 0, 0.68)");
  context.fillStyle = overlay;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  cachedOverlayCanvas = canvas;
  return canvas;
}

function drawBackgroundOverlay(context: CanvasRenderingContext2D) {
  context.drawImage(getOverlayCanvas(), 0, 0);
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

function createScaledCharacterCanvas(image: HTMLImageElement) {
  const maxWidth = 480 * CHARACTER_SCALE;
  const maxHeight = 800 * CHARACTER_SCALE;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_not_supported");
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

function drawCharacter(
  context: CanvasRenderingContext2D,
  cachedImage: HTMLCanvasElement,
  motion: CharacterMotion,
  activeProgress: number,
  side: "left" | "right",
) {
  const width = cachedImage.width;
  const height = cachedImage.height;
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
  context.drawImage(cachedImage, targetX, y);
  context.restore();
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

async function decodeDialogueAudio(audioContext: BaseAudioContext, scenes: readonly DialogueVideoScene[]) {
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

export async function canRenderDialogueDeterministically() {
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

async function renderDeterministicDialogueVideo({ audioContext, backgroundVideoUrl, backgroundVideoPath, firstCharacter, secondCharacter, scenes }: DialogueVideoRenderOptions) {
  const backgroundFetchUrl = backgroundVideoPath
    ? `/api/dialogue-background?path=${encodeURIComponent(backgroundVideoPath)}`
    : backgroundVideoUrl;
  const [backgroundVideo, firstImageRaw, secondImageRaw, audioBuffers] = await Promise.all([
    loadBackgroundVideo(backgroundFetchUrl),
    loadImage(`/mascot-variations/${encodeURIComponent(firstCharacter)}`),
    loadImage(`/mascot-variations/${encodeURIComponent(secondCharacter)}`),
    decodeDialogueAudio(audioContext, scenes),
  ]);
  const firstImage = createScaledCharacterCanvas(firstImageRaw);
  const secondImage = createScaledCharacterCanvas(secondImageRaw);
  const backgroundDuration = backgroundVideo.duration;
  if (!Number.isFinite(backgroundDuration) || backgroundDuration <= 0) {
    throw new Error("dialogue_background_load_failed");
  }
  backgroundVideo.currentTime = 0;
  await backgroundVideo.play().catch(() => { throw new Error("dialogue_background_playback_failed"); });

  const { starts, durationSeconds } = getDialogueTiming(audioBuffers, scenes);
  const frameCount = Math.ceil(durationSeconds * DETERMINISTIC_FRAME_RATE);
  const frameDuration = 1 / DETERMINISTIC_FRAME_RATE;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_not_supported");

  const target = new BufferTarget();
  const output = new Output({ format: new WebMOutputFormat(), target });
  const videoSource = new CanvasSource(canvas, {
    codec: "vp8",
    bitrate: DETERMINISTIC_VIDEO_BITRATE,
    keyFrameInterval: 5,
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
    const sceneIndex = starts.reduce((active, start, index) => start <= elapsed ? index : active, 0);
    const scene = scenes[sceneIndex]!;
    const localElapsed = Math.max(0, elapsed - starts[sceneIndex]!);
    drawBackground(context, backgroundVideo);
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
}

/**
 * Frame-exact dialogue export. Rendering proceeds frame by frame rather than
 * in real time, so slow devices take longer to export but do not skip dialogue
 * animation frames. Real-time capture is not used because it depends on the
 * browser's scheduler and can stutter on low-end devices.
 */
export async function renderDialogueVideo(options: DialogueVideoRenderOptions) {
  try {
    if (!(await canRenderDialogueDeterministically())) throw new Error("video_not_supported");
    return await renderDeterministicDialogueVideo(options);
  } finally {
    await releaseMusicVideoAudioContext(options.audioContext);
  }
}
