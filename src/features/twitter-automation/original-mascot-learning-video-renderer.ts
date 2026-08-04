import { AudioBufferSource, BufferTarget, CanvasSource, canEncodeAudio, canEncodeVideo, Output, WebMOutputFormat } from "mediabunny";
import type { OriginalMascotLearningVideoScene } from "@/features/twitter-automation/original-mascot-learning-video";

type OriginalMascotLearningVideoRenderOptions = {
  audioContext: AudioContext;
  scenes: readonly OriginalMascotLearningVideoScene[];
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const SCENE_GAP_SECONDS = 0.2;
const COUNTDOWN_SECONDS = 4;
const TIER_COLORS = { A1: "#5eead4", A2: "#7dd3fc", B1: "#c4b5fd", B2: "#fcd34d", C1: "#fda4af" } as const;
const FRAME_RATE = 30;
const VIDEO_BITRATE = 4_500_000;
const AUDIO_BITRATE = 128_000;

type PreparedSplash = { image: HTMLCanvasElement; width: number; height: number };
type OriginalMascotVideoAssets = {
  original: HTMLImageElement;
  mascot4: HTMLImageElement;
  mascot18: HTMLImageElement;
  splash: PreparedSplash;
};

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("video_asset_load_failed"));
    image.src = source;
  });
}

function recorderMimeType() {
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function easeOutQuint(value: number) {
  return 1 - (1 - Math.max(0, Math.min(1, value))) ** 5;
}

function prepareSplash(splash: HTMLImageElement): PreparedSplash {
  const source = document.createElement("canvas");
  source.width = splash.naturalWidth;
  source.height = splash.naturalHeight;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("canvas_not_supported");
  sourceContext.drawImage(splash, 0, 0);
  const { data, width, height } = sourceContext.getImageData(0, 0, source.width, source.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! < 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) throw new Error("video_asset_load_failed");
  const croppedWidth = maxX - minX + 1;
  const croppedHeight = maxY - minY + 1;
  const image = document.createElement("canvas");
  image.width = croppedWidth;
  image.height = croppedHeight;
  const imageContext = image.getContext("2d");
  if (!imageContext) throw new Error("canvas_not_supported");
  imageContext.drawImage(splash, minX, minY, croppedWidth, croppedHeight, 0, 0, croppedWidth, croppedHeight);
  return { image, width: croppedWidth, height: croppedHeight };
}

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 3;
    context.stroke();
  }
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3) {
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
  return lines.slice(0, maxLines);
}

function drawCenteredLines(context: CanvasRenderingContext2D, lines: readonly string[], x: number, y: number, lineHeight: number) {
  const firstY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => context.fillText(line, x, firstY + lineHeight * index));
}

function drawHeader(context: CanvasRenderingContext2D, splash: PreparedSplash, subtitle: string) {
  const splashWidth = 320;
  const splashHeight = splashWidth * splash.height / splash.width;
  context.drawImage(splash.image, (CANVAS_WIDTH - splashWidth) / 2, 44, splashWidth, splashHeight);
  if (!subtitle) return;
  context.fillStyle = "#f5f5f4";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "600 48px Manrope, Arial, sans-serif";
  drawCenteredLines(context, wrapText(context, subtitle, 860), CANVAS_WIDTH / 2, 198, 62);
}

function drawMascot(context: CanvasRenderingContext2D, image: HTMLImageElement, elapsed: number, speaking: boolean) {
  const maxWidth = 780;
  const maxHeight = 880;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const targetY = 1000 + Math.max(0, (maxHeight - height) / 2);
  const startY = CANVAS_HEIGHT + 80;
  const y = startY + (targetY - startY) * easeOutQuint(elapsed / 0.86);
  context.save();
  if (speaking) {
    context.globalAlpha = 0.22;
    context.fillStyle = "#f5ac27";
    context.beginPath();
    context.ellipse(CANVAS_WIDTH / 2, y + height * 0.75, width * 0.42, height * 0.22, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = Math.min(1, 0.2 + easeOutQuint(elapsed / 0.55) * 0.8);
  context.drawImage(image, (CANVAS_WIDTH - width) / 2, y, width, height);
  context.restore();
}

function drawProgression(context: CanvasRenderingContext2D, scene: Extract<OriginalMascotLearningVideoScene, { kind: "progression" }>) {
  const rowY = 380;
  const rowHeight = 132;
  scene.terms.forEach((entry, index) => {
    const active = scene.activeTier === entry.tier;
    const y = rowY + index * 150;
    drawRoundedRect(context, 100, y, 880, rowHeight, 24, active ? "#211b16" : "#12110f", active ? TIER_COLORS[entry.tier] : "#302d28");
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = TIER_COLORS[entry.tier];
    context.font = "600 34px Manrope, Arial, sans-serif";
    context.fillText(entry.tier, 142, y + rowHeight / 2);
    context.fillStyle = active ? "#fffaf4" : "#a8a29e";
    context.font = "600 52px Manrope, Arial, sans-serif";
    context.fillText(entry.term, 276, y + rowHeight / 2);
  });
}

function drawProgressionSubtitle(context: CanvasRenderingContext2D, subtitle: string) {
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#f76808";
  context.font = "600 44px Manrope, Arial, sans-serif";
  drawCenteredLines(context, wrapText(context, subtitle, 880), CANVAS_WIDTH / 2, 900, 54);
}

function drawQuiz(context: CanvasRenderingContext2D, scene: Extract<OriginalMascotLearningVideoScene, { kind: "quiz" }>, localElapsed: number) {
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = TIER_COLORS[scene.tier];
  context.font = "600 26px Manrope, Arial, sans-serif";
  context.fillText(`${scene.tier} QUICK QUIZ`, CANVAS_WIDTH / 2, 352);
  context.fillStyle = "#fffaf4";
  context.font = "600 76px Manrope, Arial, sans-serif";
  drawCenteredLines(context, wrapText(context, scene.term, 850, 2), CANVAS_WIDTH / 2, 448, 86);
  scene.options.forEach((option, index) => {
    const reveal = scene.phase === "reveal" || scene.phase === "explanation";
    const correct = index === scene.correctIndex;
    const fill = reveal && correct ? "#14532d" : "#141210";
    const stroke = reveal && correct ? "#86efac" : "#37332d";
    const y = 574 + index * 120;
    drawRoundedRect(context, 100, y, 880, 94, 20, fill, stroke);
    context.textAlign = "left";
    context.fillStyle = reveal && correct ? "#dcfce7" : "#e7e5e4";
    context.font = "500 34px Manrope, Arial, sans-serif";
    context.fillText(option, 142, y + 48);
  });
  if (scene.phase === "countdown") drawClock(context, localElapsed);
}

function drawClock(context: CanvasRenderingContext2D, elapsed: number) {
  const remaining = Math.max(0, COUNTDOWN_SECONDS - elapsed);
  const progress = Math.min(1, elapsed / COUNTDOWN_SECONDS);
  const x = CANVAS_WIDTH / 2;
  const y = 1120;
  context.save();
  context.lineWidth = 16;
  context.strokeStyle = "#292524";
  context.beginPath();
  context.arc(x, y, 96, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = "#f5ac27";
  context.beginPath();
  context.arc(x, y, 96, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - progress));
  context.stroke();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fffaf4";
  context.font = "600 64px Manrope, Arial, sans-serif";
  context.fillText(String(Math.max(0, Math.ceil(remaining))), x, y + 3);
  context.restore();
}

function drawSentence(context: CanvasRenderingContext2D, scene: Extract<OriginalMascotLearningVideoScene, { kind: "sentence" }>, localElapsed: number) {
  drawRoundedRect(context, 88, 366, 904, 330, 28, "#141210", "#37332d");
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#fffaf4";
  context.font = "600 50px Manrope, Arial, sans-serif";
  drawCenteredLines(context, wrapText(context, scene.sentence, 790, 4), CANVAS_WIDTH / 2, 528, 62);
  if (scene.phase === "countdown") {
    drawClock(context, localElapsed);
    return;
  }
  if (scene.phase === "reveal" || scene.phase === "explanation") {
    const color = scene.isCorrect ? "#86efac" : "#fda4af";
    drawRoundedRect(context, 168, 748, 744, 92, 18, scene.isCorrect ? "#14532d" : "#631c28", color);
    context.fillStyle = color;
    context.font = "600 34px Manrope, Arial, sans-serif";
    context.fillText(scene.isCorrect ? "CORRECT" : "INCORRECT", CANVAS_WIDTH / 2, 794);
    if (scene.correction) {
      context.fillStyle = "#e7e5e4";
      context.font = "500 34px Manrope, Arial, sans-serif";
      drawCenteredLines(context, wrapText(context, scene.correction, 800, 2), CANVAS_WIDTH / 2, 900, 44);
    }
  }
}

function scheduleCountdownTicks(context: BaseAudioContext, destination: AudioNode, startTime: number) {
  for (let index = 0; index < COUNTDOWN_SECONDS; index += 1) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(960, startTime + index);
    gain.gain.setValueAtTime(0.0001, startTime + index);
    gain.gain.exponentialRampToValueAtTime(0.16, startTime + index + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + index + 0.11);
    oscillator.connect(gain).connect(destination);
    oscillator.start(startTime + index);
    oscillator.stop(startTime + index + 0.13);
  }
}

function getOriginalMascotTiming(buffers: readonly (AudioBuffer | null)[], scenes: readonly OriginalMascotLearningVideoScene[]) {
  const starts: number[] = [];
  let elapsedSeconds = 0;
  scenes.forEach((scene, index) => {
    starts.push(elapsedSeconds);
    elapsedSeconds += scene.durationSeconds ?? buffers[index]?.duration ?? 1;
    if (index < scenes.length - 1) elapsedSeconds += SCENE_GAP_SECONDS;
  });
  return { starts, durationSeconds: elapsedSeconds + 0.35 };
}

function drawOriginalMascotFrame(
  context: CanvasRenderingContext2D,
  assets: OriginalMascotVideoAssets,
  scenes: readonly OriginalMascotLearningVideoScene[],
  starts: readonly number[],
  durationSeconds: number,
  elapsed: number,
) {
  const clampedElapsed = Math.min(durationSeconds, Math.max(0, elapsed));
  const sceneIndex = starts.reduce((active, start, index) => start <= clampedElapsed ? index : active, 0);
  const scene = scenes[sceneIndex]!;
  const localElapsed = Math.max(0, clampedElapsed - starts[sceneIndex]!);
  context.fillStyle = "#090909";
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.fillStyle = "#14110e";
  context.beginPath();
  context.ellipse(CANVAS_WIDTH / 2, 1460, 640, 520, 0, 0, Math.PI * 2);
  context.fill();
  drawHeader(context, assets.splash, scene.kind === "progression" ? "" : scene.subtitle);
  if (scene.kind === "progression") {
    drawProgression(context, scene);
    drawProgressionSubtitle(context, scene.subtitle);
  }
  if (scene.kind === "quiz") drawQuiz(context, scene, localElapsed);
  if (scene.kind === "sentence") drawSentence(context, scene, localElapsed);
  const mascot = scene.kind === "progression" ? assets[scene.mascot] : assets.original;
  drawMascot(context, mascot, clampedElapsed, Boolean(scene.audioDataUrl));
}

async function loadOriginalMascotVideoAssets(): Promise<OriginalMascotVideoAssets> {
  const [original, mascot4, mascot18, splash] = await Promise.all([
    loadImage("/mascot-variations/Original.png"),
    loadImage("/mascots/mascot4.webp"),
    loadImage("/mascots/mascot18.png"),
    loadImage("/splash.png"),
  ]);
  return { original, mascot4, mascot18, splash: prepareSplash(splash) };
}

async function decodeOriginalMascotAudio(audioContext: AudioContext, scenes: readonly OriginalMascotLearningVideoScene[]) {
  return await Promise.all(scenes.map(async (scene) => {
    if (!scene.audioDataUrl) return null;
    const response = await fetch(scene.audioDataUrl);
    if (!response.ok) throw new Error("speech_load_failed");
    return await audioContext.decodeAudioData(await response.arrayBuffer());
  }));
}

async function renderOriginalMascotOfflineAudio(
  buffers: readonly (AudioBuffer | null)[],
  scenes: readonly OriginalMascotLearningVideoScene[],
  starts: readonly number[],
  durationSeconds: number,
) {
  const sampleRate = 48_000;
  const offlineContext = new OfflineAudioContext(2, Math.ceil(durationSeconds * sampleRate), sampleRate);
  buffers.forEach((buffer, index) => {
    if (!buffer) return;
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start(starts[index]!);
  });
  scenes.forEach((scene, index) => {
    if ((scene.kind === "quiz" || scene.kind === "sentence") && scene.phase === "countdown") {
      scheduleCountdownTicks(offlineContext, offlineContext.destination, starts[index]!);
    }
  });
  return await offlineContext.startRendering();
}

async function canRenderOriginalMascotDeterministically() {
  if (typeof OfflineAudioContext === "undefined") return false;
  return await canEncodeVideo("vp8", { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, bitrate: VIDEO_BITRATE })
    && await canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000, bitrate: AUDIO_BITRATE });
}

async function renderDeterministicOriginalMascotLearningVideo({ audioContext, scenes }: OriginalMascotLearningVideoRenderOptions) {
  const [assets, buffers] = await Promise.all([
    loadOriginalMascotVideoAssets(),
    decodeOriginalMascotAudio(audioContext, scenes),
  ]);

  try {
    const { starts, durationSeconds } = getOriginalMascotTiming(buffers, scenes);
    const frameCount = Math.ceil(durationSeconds * FRAME_RATE);
    const frameDuration = 1 / FRAME_RATE;
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas_not_supported");

    const target = new BufferTarget();
    const output = new Output({ format: new WebMOutputFormat(), target });
    const videoSource = new CanvasSource(canvas, { codec: "vp8", bitrate: VIDEO_BITRATE, keyFrameInterval: 2 });
    const audioSource = new AudioBufferSource({ codec: "opus", bitrate: AUDIO_BITRATE });
    output.addVideoTrack(videoSource, { maximumPacketCount: frameCount });
    output.addAudioTrack(audioSource);
    await output.start();
    await audioSource.add(await renderOriginalMascotOfflineAudio(buffers, scenes, starts, frameCount * frameDuration));
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      drawOriginalMascotFrame(context, assets, scenes, starts, durationSeconds, frameIndex * frameDuration);
      await videoSource.add(frameIndex * frameDuration, frameDuration, { keyFrame: frameIndex % (FRAME_RATE * 2) === 0 });
    }
    await output.finalize();
    if (!target.buffer) throw new Error("deterministic_recording_failed");
    return new Blob([target.buffer], { type: await output.getMimeType() });
  } finally {
    await audioContext.close();
  }
}

/** Legacy real-time renderer for browsers without WebCodecs. */
async function renderRealtimeOriginalMascotLearningVideo({ audioContext, scenes }: OriginalMascotLearningVideoRenderOptions) {
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") throw new Error("video_not_supported");
  if (scenes.length < 4 || scenes.length > 12) throw new Error("invalid_video_scene_count");

  const assets = await loadOriginalMascotVideoAssets();
  const buffers = await decodeOriginalMascotAudio(audioContext, scenes);
  const { starts, durationSeconds } = getOriginalMascotTiming(buffers, scenes);
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_not_supported");

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
  buffers.forEach((buffer, index) => {
    if (!buffer) return;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    source.start(startTime + starts[index]!);
  });
  scenes.forEach((scene, index) => {
    if ((scene.kind === "quiz" || scene.kind === "sentence") && scene.phase === "countdown") scheduleCountdownTicks(audioContext, destination, startTime + starts[index]!);
  });

  let animationId = 0;
  let stopped = false;
  const startedAt = performance.now();
  const drawFrame = (now: number) => {
    const elapsed = Math.min(durationSeconds, (now - startedAt) / 1000);
    drawOriginalMascotFrame(context, assets, scenes, starts, durationSeconds, elapsed);
    if (!stopped && elapsed < durationSeconds) animationId = window.requestAnimationFrame(drawFrame);
  };

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
    await audioContext.close();
  }
}

/** Browser-only 9:16 renderer with frame-exact WebCodecs export on Chrome/Android. */
export async function renderOriginalMascotLearningVideo(options: OriginalMascotLearningVideoRenderOptions) {
  if (options.scenes.length < 4 || options.scenes.length > 12) throw new Error("invalid_video_scene_count");
  if (await canRenderOriginalMascotDeterministically()) {
    return await renderDeterministicOriginalMascotLearningVideo(options);
  }
  return await renderRealtimeOriginalMascotLearningVideo(options);
}
