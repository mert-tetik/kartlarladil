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
const SCENE_GAP_SECONDS = 0.22;
const SUBTITLE_MAX_WIDTH = 900;

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
  context.fillStyle = "#f5f5f4";
  context.font = "600 54px Manrope, Arial, sans-serif";
  const primary = wrapText(context, scene.text, SUBTITLE_MAX_WIDTH);
  const translation = scene.translation?.trim() ? wrapText(context, scene.translation, SUBTITLE_MAX_WIDTH) : [];
  const primaryLineHeight = 68;
  const translationLineHeight = 50;
  const totalHeight = primary.length * primaryLineHeight + (translation.length ? 30 + translation.length * translationLineHeight : 0);
  let y = 320 - totalHeight / 2 + primaryLineHeight / 2;
  primary.forEach((line) => {
    context.fillText(line, CANVAS_WIDTH / 2, y);
    y += primaryLineHeight;
  });
  if (translation.length) {
    y += 15;
    context.fillStyle = "#a8a29e";
    context.font = "500 38px Manrope, Arial, sans-serif";
    translation.forEach((line) => {
      context.fillText(line, CANVAS_WIDTH / 2, y);
      y += translationLineHeight;
    });
  }
}

function drawBackground(context: CanvasRenderingContext2D, video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("dialogue_background_load_failed");
  const scale = Math.max(CANVAS_WIDTH / sourceWidth, CANVAS_HEIGHT / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.drawImage(video, (CANVAS_WIDTH - width) / 2, (CANVAS_HEIGHT - height) / 2, width, height);
  const overlay = context.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  overlay.addColorStop(0, "rgba(0, 0, 0, 0.74)");
  overlay.addColorStop(0.42, "rgba(0, 0, 0, 0.42)");
  overlay.addColorStop(1, "rgba(0, 0, 0, 0.68)");
  context.fillStyle = overlay;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawCharacter(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  revealProgress: number,
  activeProgress: number,
  side: "left" | "right",
  isActive: boolean,
) {
  const maxWidth = 480;
  const maxHeight = 800;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const targetX = side === "left" ? 42 : CANVAS_WIDTH - width - 42;
  const targetY = 980 + Math.max(0, (maxHeight - height) / 2);
  const startY = CANVAS_HEIGHT + 90;
  const eased = easeOutQuint(revealProgress);
  const talkingLift = isActive ? Math.sin(Math.min(1, activeProgress / 0.44) * Math.PI) * 18 : 0;
  const y = startY + (targetY - startY) * eased - talkingLift;
  context.save();
  context.globalAlpha = isActive ? Math.min(1, 0.3 + eased * 0.7) : Math.min(0.68, eased * 0.68);
  context.drawImage(image, targetX, y, width, height);
  context.restore();
}

/** Browser-only 9:16 dialogue renderer. Each speaker rises from below the frame on their turn. */
export async function renderDialogueVideo({ audioContext, backgroundVideoUrl, firstCharacter, secondCharacter, scenes }: DialogueVideoRenderOptions) {
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
  const firstTurnStarts = {
    1: starts.find((_, index) => scenes[index]?.character === 1) ?? Number.POSITIVE_INFINITY,
    2: starts.find((_, index) => scenes[index]?.character === 2) ?? Number.POSITIVE_INFINITY,
  } as const;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
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

  let animationId = 0;
  let stopped = false;
  const startedAt = performance.now();
  const drawFrame = (now: number) => {
    const elapsed = Math.min(durationSeconds, (now - startedAt) / 1000);
    const sceneIndex = starts.reduce((active, start, index) => start <= elapsed ? index : active, 0);
    const scene = scenes[sceneIndex]!;
    const localElapsed = Math.max(0, elapsed - starts[sceneIndex]!);
    drawBackground(context, backgroundVideo);
    drawSubtitles(context, scene);
    drawCharacter(context, firstImage, Math.max(0, elapsed - firstTurnStarts[1]) / 0.82, localElapsed, "left", scene.character === 1);
    drawCharacter(context, secondImage, Math.max(0, elapsed - firstTurnStarts[2]) / 0.82, localElapsed, "right", scene.character === 2);
    if (!stopped && elapsed < durationSeconds) animationId = window.requestAnimationFrame(drawFrame);
  };

  await backgroundVideo.play().catch(() => { throw new Error("dialogue_background_playback_failed"); });
  drawFrame(startedAt);
  recorder.start(250);
  window.setTimeout(() => {
    stopped = true;
    window.cancelAnimationFrame(animationId);
    videoStream.getTracks().forEach((track) => track.stop());
    if (recorder.state !== "inactive") recorder.stop();
  }, durationSeconds * 1000);

  try {
    return await completed;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    destination.disconnect();
    backgroundVideo.pause();
    backgroundVideo.removeAttribute("src");
    backgroundVideo.load();
    backgroundVideo.remove();
    await audioContext.close();
  }
}
