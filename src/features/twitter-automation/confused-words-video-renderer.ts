export type ConfusedWordsVideoScene = {
  text: string;
  mascot: 3 | 4 | 18;
  mirrored: boolean;
  audioDataUrl: string;
};

type ConfusedWordsVideoRenderOptions = {
  audioContext: AudioContext;
  firstTerm: string;
  secondTerm: string;
  tier: string;
  scenes: readonly ConfusedWordsVideoScene[];
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const SCENE_GAP_SECONDS = 0.18;
const TTS_PLAYBACK_RATE = 1.25 / 1.2;
const TIER_CARD_COLORS: Record<string, { accent: string; ink: string; border: string }> = {
  A1: { accent: "#16a34a", ink: "#14532d", border: "#86efac" },
  A2: { accent: "#0284c7", ink: "#0c4a6e", border: "#7dd3fc" },
  B1: { accent: "#7c3aed", ink: "#4c1d95", border: "#c4b5fd" },
  B2: { accent: "#d97706", ink: "#78350f", border: "#fcd34d" },
  C1: { accent: "#e11d48", ink: "#881337", border: "#fda4af" },
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

function drawRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 4;
    context.stroke();
  }
}

function drawTerm(context: CanvasRenderingContext2D, term: string, x: number, y: number, maxWidth: number) {
  const words = term.split(/\s+/u).filter(Boolean);
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
  const visibleLines = lines.slice(0, 3);
  const lineHeight = 82;
  const firstY = y - ((visibleLines.length - 1) * lineHeight) / 2;
  visibleLines.forEach((entry, index) => context.fillText(entry, x, firstY + index * lineHeight));
}

function drawCard(context: CanvasRenderingContext2D, term: string, x: number, tier: string) {
  const palette = TIER_CARD_COLORS[tier] ?? TIER_CARD_COLORS.A1;
  const width = 430;
  const height = 560;
  drawRoundedRect(context, x, 360, width, height, 28, "#fffaf4", palette.border);
  drawRoundedRect(context, x + 18, 378, width - 36, 74, 16, palette.accent);
  context.fillStyle = "#ffffff";
  context.font = "600 30px Manrope, Arial, sans-serif";
  context.textAlign = "left";
  context.fillText(`${tier} · FoxiesDeck`, x + 42, 425);
  context.fillStyle = palette.ink;
  context.font = "600 70px Manrope, Arial, sans-serif";
  context.textAlign = "center";
  drawTerm(context, term, x + width / 2, 640, width - 80);
  context.fillStyle = "#57534e";
  context.font = "500 28px Manrope, Arial, sans-serif";
  context.fillText("Vocabulary card", x + width / 2, 842);
}

function drawTintedSplash(context: CanvasRenderingContext2D, splash: HTMLImageElement) {
  const width = 520;
  const height = splash.naturalHeight ? width * splash.naturalHeight / splash.naturalWidth : 150;
  const x = (CANVAS_WIDTH - width) / 2;
  const y = 105;
  context.save();
  context.drawImage(splash, x, y, width, height);
  context.globalCompositeOperation = "source-atop";
  context.fillStyle = "#f97316";
  context.fillRect(x, y, width, height);
  context.restore();
}

function drawMascot(context: CanvasRenderingContext2D, image: HTMLImageElement, mirrored: boolean) {
  const maxWidth = 820;
  const maxHeight = 800;
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (CANVAS_WIDTH - width) / 2;
  const y = 1030 + Math.max(0, (maxHeight - height) / 2);
  context.save();
  if (mirrored) {
    context.translate(CANVAS_WIDTH, 0);
    context.scale(-1, 1);
    context.drawImage(image, CANVAS_WIDTH - x - width, y, width, height);
  } else context.drawImage(image, x, y, width, height);
  context.restore();
}

export async function renderConfusedWordsVideo({ audioContext, firstTerm, secondTerm, tier, scenes }: ConfusedWordsVideoRenderOptions) {
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") throw new Error("video_not_supported");
  if (scenes.length !== 8) throw new Error("invalid_video_scene_count");

  const [splash, mascot3, mascot4, mascot18] = await Promise.all([
    loadImage("/splash.png"),
    loadImage("/mascots/mascot3.webp"),
    loadImage("/mascots/mascot4.webp"),
    loadImage("/mascots/mascot18.png"),
  ]);
  const audioBuffers = await Promise.all(scenes.map(async (scene) => {
    const response = await fetch(scene.audioDataUrl);
    if (!response.ok) throw new Error("speech_load_failed");
    return await audioContext.decodeAudioData(await response.arrayBuffer());
  }));
  const mascots = { 3: mascot3, 4: mascot4, 18: mascot18 } as const;
  let elapsedSeconds = 0;
  const starts = audioBuffers.map((buffer) => {
    const start = elapsedSeconds;
    elapsedSeconds += buffer.duration / TTS_PLAYBACK_RATE + SCENE_GAP_SECONDS;
    return start;
  });
  const durationSeconds = elapsedSeconds - SCENE_GAP_SECONDS + 0.28;
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
  const complete = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => reject(new Error("recording_failed"));
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });

  const startTime = audioContext.currentTime + 0.08;
  audioBuffers.forEach((buffer, index) => {
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = TTS_PLAYBACK_RATE;
    source.connect(destination);
    source.start(startTime + starts[index]!);
  });

  let animationId = 0;
  let stopped = false;
  const startedAt = performance.now();
  const drawFrame = (now: number) => {
    const elapsed = Math.min(durationSeconds, (now - startedAt) / 1000);
    const sceneIndex = starts.reduce((activeIndex, start, index) => start <= elapsed ? index : activeIndex, 0);
    const scene = scenes[sceneIndex]!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawTintedSplash(context, splash);
    drawCard(context, firstTerm, 80, tier);
    drawCard(context, secondTerm, 570, tier);
    drawMascot(context, mascots[scene.mascot], scene.mirrored);
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
    return await complete;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    destination.disconnect();
    await audioContext.close();
  }
}
