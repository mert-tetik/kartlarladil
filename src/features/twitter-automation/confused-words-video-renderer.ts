import { AudioBufferSource, BufferTarget, CanvasSource, canEncodeAudio, canEncodeVideo, Output, WebMOutputFormat } from "mediabunny";
import { releaseMusicVideoAudioContext } from "@/features/twitter-automation/automation-music-video-audio-session";
import type { VocabularyCard } from "@/types/domain";

export type ConfusedWordsVideoScene = {
  phaseIndex?: number;
  text: string;
  mascot: 3 | 4 | 18;
  mirrored: boolean;
  playbackRate?: number;
  audioDataUrl: string;
};

type ConfusedWordsCardPair = {
  first: Pick<VocabularyCard, "term" | "tier">;
  second: Pick<VocabularyCard, "term" | "tier">;
};

type ConfusedWordsVideoRenderOptions = {
  audioContext: BaseAudioContext;
  cardImageUrls?: readonly string[];
  phases?: readonly ConfusedWordsCardPair[];
  /** Legacy two-card input retained for Automation Table render requests. */
  firstCardImageUrl?: string;
  secondCardImageUrl?: string;
  firstCard?: Pick<VocabularyCard, "term" | "tier">;
  secondCard?: Pick<VocabularyCard, "term" | "tier">;
  scenes: readonly ConfusedWordsVideoScene[];
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const AUDIO_CROSSFADE_SECONDS = 0.09;
const CARD_WIDTH = 430;
const CARD_Y = 360;
const CARD_HIGHLIGHT_SCALE = 1.075;
const CARD_TRANSITION_SECONDS = 0.32;
const FRAME_RATE = 30;
const VIDEO_BITRATE = 4_500_000;
const AUDIO_BITRATE = 128_000;
const MASCOT_BY_PHASE_SCENE = [18, 18, 18, 3, 4, 4, 4, 4] as const;
const MIRRORED_BY_PHASE_SCENE = [true, true, false, false, true, true, false, false] as const;
const SUBTITLE_FONT = '700 64px Manrope, Arial, sans-serif';
const SUBTITLE_COLOR = '#f97316';
const SUBTITLE_Y = 980;
const SUBTITLE_MAX_WIDTH = 920;
const SUBTITLE_LINE_HEIGHT = 78;
const MASCOT_MAX_WIDTH = 720;
const MASCOT_MAX_HEIGHT = 700;

type VisibleImageBounds = { x: number; y: number; width: number; height: number };
type PreparedSplash = { image: HTMLCanvasElement; x: number; y: number };

export function getConfusedWordsSceneIndex(starts: readonly number[], elapsed: number) {
  return starts.reduce((activeIndex, start, index) => start <= elapsed ? index : activeIndex, 0);
}

export function getConfusedWordsPhaseIndex(sceneIndex: number) {
  return Math.floor(sceneIndex / MASCOT_BY_PHASE_SCENE.length);
}

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
  return 1 - Math.pow(1 - Math.max(0, Math.min(1, value)), 5);
}

function findVisibleImageBounds(image: HTMLImageElement): VisibleImageBounds {
  const source = document.createElement("canvas");
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) return { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
  sourceContext.drawImage(image, 0, 0);
  const { data, width, height } = sourceContext.getImageData(0, 0, source.width, source.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! < 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? { x: 0, y: 0, width, height } : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function prepareTintedSplash(splash: HTMLImageElement, bounds: VisibleImageBounds): PreparedSplash {
  const width = 720;
  const height = bounds.width ? width * bounds.height / bounds.width : 150;
  const x = (CANVAS_WIDTH - width) / 2;
  const y = 120;
  const image = document.createElement("canvas");
  image.width = Math.ceil(width);
  image.height = Math.ceil(height);
  const imageContext = image.getContext("2d");
  if (!imageContext) throw new Error("canvas_not_supported");
  imageContext.drawImage(splash, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, image.width, image.height);
  imageContext.globalCompositeOperation = "source-in";
  imageContext.fillStyle = "#f97316";
  imageContext.fillRect(0, 0, image.width, image.height);
  return { image, x, y };
}

function drawTintedSplash(context: CanvasRenderingContext2D, splash: PreparedSplash) {
  context.drawImage(splash.image, splash.x, splash.y);
}

function drawAppCard(context: CanvasRenderingContext2D, cardImage: HTMLImageElement, x: number, scale = 1) {
  const baseHeight = CARD_WIDTH * cardImage.naturalHeight / cardImage.naturalWidth;
  const width = CARD_WIDTH * scale;
  const height = baseHeight * scale;
  context.drawImage(cardImage, x + (CARD_WIDTH - width) / 2, CARD_Y + (baseHeight - height) / 2, width, height);
}

function drawFallbackCard(context: CanvasRenderingContext2D, card: Pick<VocabularyCard, "term" | "tier">, x: number, scale = 1) {
  const height = 574;
  const width = CARD_WIDTH * scale;
  const scaledHeight = height * scale;
  const left = x + (CARD_WIDTH - width) / 2;
  const top = CARD_Y + (height - scaledHeight) / 2;
  context.save();
  context.translate(left, top);
  context.scale(scale, scale);
  context.fillStyle = "#fffdf9";
  context.fillRect(0, 0, CARD_WIDTH, height);
  context.fillStyle = "#f5ac27";
  context.fillRect(0, 0, CARD_WIDTH, 84);
  context.fillStyle = "#ffffff";
  context.font = "600 32px Manrope, Arial, sans-serif";
  context.textAlign = "left";
  context.fillText(card.tier, 34, 54);
  context.fillStyle = "#211b16";
  context.font = "600 58px Manrope, Arial, sans-serif";
  context.textAlign = "center";
  context.fillText(card.term, CARD_WIDTH / 2, 290, CARD_WIDTH - 56);
  context.restore();
}

function drawMascot(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  mirrored: boolean,
  opacity = 1,
) {
  const scale = Math.min(MASCOT_MAX_WIDTH / image.naturalWidth, MASCOT_MAX_HEIGHT / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const x = (CANVAS_WIDTH - width) / 2;
  const y = 1030 + Math.max(0, (MASCOT_MAX_HEIGHT - height) / 2);
  context.save();
  context.globalAlpha = opacity;
  if (mirrored) {
    // Draw in a mirrored canvas coordinate space; using the original x keeps
    // the bitmap visibly flipped instead of canceling the transform out.
    context.translate(CANVAS_WIDTH, 0);
    context.scale(-1, 1);
  }
  context.drawImage(image, x, y, width, height);
  context.restore();
}

function resolvePhasePairs({ phases, firstCard, secondCard }: ConfusedWordsVideoRenderOptions) {
  if (phases?.length) return phases;
  return firstCard && secondCard ? [{ first: firstCard, second: secondCard }] : [];
}

const subtitleCache = new Map<string, HTMLCanvasElement>();

function wrapSubtitleText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function renderSubtitleToCache(text: string) {
  const cached = subtitleCache.get(text);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = 280;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_not_supported");
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = SUBTITLE_FONT;
  const lines = wrapSubtitleText(context, text, SUBTITLE_MAX_WIDTH);
  const totalHeight = lines.length * SUBTITLE_LINE_HEIGHT;
  let y = canvas.height / 2 - totalHeight / 2 + SUBTITLE_LINE_HEIGHT / 2;
  context.fillStyle = SUBTITLE_COLOR;
  for (const line of lines) {
    context.fillText(line, CANVAS_WIDTH / 2, y);
    y += SUBTITLE_LINE_HEIGHT;
  }
  subtitleCache.set(text, canvas);
  return canvas;
}

function drawSceneSubtitle(context: CanvasRenderingContext2D, text: string) {
  const cached = renderSubtitleToCache(text);
  context.drawImage(cached, 0, SUBTITLE_Y - cached.height / 2);
}

type ConfusedWordsFrameAssets = {
  tintedSplash: PreparedSplash;
  mascots: Record<3 | 4 | 18, HTMLImageElement>;
  cardImages: readonly HTMLImageElement[];
  phasePairs: readonly ConfusedWordsCardPair[];
};

function drawConfusedWordsFrame(
  context: CanvasRenderingContext2D,
  assets: ConfusedWordsFrameAssets,
  scenes: readonly ConfusedWordsVideoScene[],
  starts: readonly number[],
  durationSeconds: number,
  elapsed: number,
) {
  const clampedElapsed = Math.min(durationSeconds, Math.max(0, elapsed));
  const sceneIndex = getConfusedWordsSceneIndex(starts, clampedElapsed);
  const phaseIndex = getConfusedWordsPhaseIndex(sceneIndex);
  const phaseSceneIndex = sceneIndex % MASCOT_BY_PHASE_SCENE.length;
  const visibleMascot = MASCOT_BY_PHASE_SCENE[phaseSceneIndex]!;
  const visibleMirrored = MIRRORED_BY_PHASE_SCENE[phaseSceneIndex]!;
  const previousPhaseSceneIndex = (sceneIndex - 1 + MASCOT_BY_PHASE_SCENE.length) % MASCOT_BY_PHASE_SCENE.length;
  const localSceneElapsed = clampedElapsed - starts[sceneIndex]!;
  const transitionProgress = easeOutQuint(localSceneElapsed / CARD_TRANSITION_SECONDS);
  const highlightedSide = visibleMirrored ? "left" : "right";
  const previousHighlightedSide = sceneIndex > 0 ? MIRRORED_BY_PHASE_SCENE[previousPhaseSceneIndex]! ? "left" : "right" : null;
  const cardScale = (side: "left" | "right") => {
    const from = previousHighlightedSide === side ? CARD_HIGHLIGHT_SCALE : 1;
    const to = highlightedSide === side ? CARD_HIGHLIGHT_SCALE : 1;
    return from + (to - from) * transitionProgress;
  };
  const pair = assets.phasePairs[phaseIndex] ?? assets.phasePairs[0];
  const firstCardImage = assets.cardImages[phaseIndex * 2] ?? assets.cardImages[0];
  const secondCardImage = assets.cardImages[phaseIndex * 2 + 1] ?? assets.cardImages[1];

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawTintedSplash(context, assets.tintedSplash);
  const sceneText = scenes[sceneIndex]?.text;
  if (sceneText) drawSceneSubtitle(context, sceneText);
  const drawCard = (side: "left" | "right") => {
    const x = side === "left" ? 80 : 570;
    const cardImage = side === "left" ? firstCardImage : secondCardImage;
    const card = side === "left" ? pair?.first : pair?.second;
    if (cardImage) drawAppCard(context, cardImage, x, cardScale(side));
    else if (card) drawFallbackCard(context, card, x, cardScale(side));
  };
  drawCard(highlightedSide === "left" ? "right" : "left");
  drawCard(highlightedSide);
  drawMascot(context, assets.mascots[visibleMascot], visibleMirrored);
}

function getConfusedWordsTiming(audioBuffers: readonly AudioBuffer[], playbackRates: readonly number[]) {
  let elapsedSeconds = 0;
  const starts = audioBuffers.map((buffer, index) => {
    const start = elapsedSeconds;
    const duration = buffer.duration / playbackRates[index]!;
    elapsedSeconds += index === audioBuffers.length - 1 ? duration : Math.max(0.04, duration - AUDIO_CROSSFADE_SECONDS);
    return start;
  });
  return { starts, durationSeconds: elapsedSeconds + 0.28 };
}

async function decodeConfusedWordsAudio(audioContext: BaseAudioContext, scenes: readonly ConfusedWordsVideoScene[]) {
  return await Promise.all(scenes.map(async (scene) => {
    const response = await fetch(scene.audioDataUrl);
    if (!response.ok) throw new Error("speech_load_failed");
    return await audioContext.decodeAudioData(await response.arrayBuffer());
  }));
}

async function renderConfusedWordsOfflineAudio(
  audioBuffers: readonly AudioBuffer[],
  playbackRates: readonly number[],
  starts: readonly number[],
  durationSeconds: number,
) {
  const sampleRate = 48_000;
  const offlineContext = new OfflineAudioContext(2, Math.ceil(durationSeconds * sampleRate), sampleRate);
  audioBuffers.forEach((buffer, index) => {
    const source = offlineContext.createBufferSource();
    const gain = offlineContext.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRates[index]!;
    source.connect(gain).connect(offlineContext.destination);
    const sourceStart = starts[index]!;
    const sourceDuration = buffer.duration / playbackRates[index]!;
    const fadeDuration = Math.min(AUDIO_CROSSFADE_SECONDS, sourceDuration / 3);
    if (index > 0) {
      gain.gain.setValueAtTime(0, sourceStart);
      gain.gain.linearRampToValueAtTime(1, sourceStart + fadeDuration);
    } else {
      gain.gain.setValueAtTime(1, sourceStart);
    }
    if (index < audioBuffers.length - 1) {
      gain.gain.setValueAtTime(1, sourceStart + Math.max(fadeDuration, sourceDuration - fadeDuration));
      gain.gain.linearRampToValueAtTime(0, sourceStart + sourceDuration);
    }
    source.start(sourceStart);
  });
  return await offlineContext.startRendering();
}

export async function canRenderConfusedWordsDeterministically() {
  if (typeof OfflineAudioContext === "undefined") return false;
  return await canEncodeVideo("vp8", { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, bitrate: VIDEO_BITRATE })
    && await canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000, bitrate: AUDIO_BITRATE });
}

async function loadConfusedWordsAssets(options: ConfusedWordsVideoRenderOptions) {
  const { cardImageUrls, firstCardImageUrl, secondCardImageUrl } = options;
  const normalizedCardUrls = cardImageUrls?.length ? cardImageUrls : [firstCardImageUrl, secondCardImageUrl].filter((url): url is string => Boolean(url));
  const [splash, mascot3, mascot4, mascot18, ...cardImages] = await Promise.all([
    loadImage("/splash.png"),
    loadImage("/mascots/mascot3.webp"),
    loadImage("/mascots/mascot4.webp"),
    loadImage("/mascots/mascot18.png"),
    ...normalizedCardUrls.map((url) => loadImage(url)),
  ]);
  return {
    tintedSplash: prepareTintedSplash(splash, findVisibleImageBounds(splash)),
    mascots: { 3: mascot3, 4: mascot4, 18: mascot18 } as const,
    cardImages,
    phasePairs: resolvePhasePairs(options),
  } satisfies ConfusedWordsFrameAssets;
}

async function renderDeterministicConfusedWordsVideo(options: ConfusedWordsVideoRenderOptions) {
  const { audioContext, scenes } = options;
  const [assets, audioBuffers] = await Promise.all([loadConfusedWordsAssets(options), decodeConfusedWordsAudio(audioContext, scenes)]);
  try {
    const playbackRates = scenes.map((scene) => scene.playbackRate ?? 1);
    const { starts, durationSeconds } = getConfusedWordsTiming(audioBuffers, playbackRates);
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
    await audioSource.add(await renderConfusedWordsOfflineAudio(audioBuffers, playbackRates, starts, frameCount * frameDuration));
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      drawConfusedWordsFrame(context, assets, scenes, starts, durationSeconds, frameIndex * frameDuration);
      await videoSource.add(frameIndex * frameDuration, frameDuration, { keyFrame: frameIndex % (FRAME_RATE * 2) === 0 });
    }
    await output.finalize();
    if (!target.buffer) throw new Error("deterministic_recording_failed");
    return new Blob([target.buffer], { type: await output.getMimeType() });
  } finally {
    await releaseMusicVideoAudioContext(audioContext);
  }
}

/** Legacy real-time renderer for browsers without WebCodecs. */
type RealtimeConfusedWordsVideoRenderOptions = Omit<ConfusedWordsVideoRenderOptions, "audioContext"> & { audioContext: AudioContext };

function isRealtimeAudioContext(audioContext: BaseAudioContext): audioContext is AudioContext {
  return "createMediaStreamDestination" in audioContext && typeof audioContext.createMediaStreamDestination === "function";
}

async function renderRealtimeConfusedWordsVideo(options: RealtimeConfusedWordsVideoRenderOptions) {
  const { audioContext, cardImageUrls, firstCardImageUrl, secondCardImageUrl, scenes } = options;
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") throw new Error("video_not_supported");
  if (!scenes.length || scenes.length % 8 !== 0) throw new Error("invalid_video_scene_count");
  const phasePairs = resolvePhasePairs(options);
  const phaseCount = scenes.length / MASCOT_BY_PHASE_SCENE.length;
  if (phasePairs.length < phaseCount && !cardImageUrls?.length && !firstCardImageUrl && !secondCardImageUrl) throw new Error("confused_words_cards_unavailable");

  const [assets, audioBuffers] = await Promise.all([loadConfusedWordsAssets(options), decodeConfusedWordsAudio(audioContext, scenes)]);
  const playbackRates = scenes.map((scene) => scene.playbackRate ?? 1);
  const { starts, durationSeconds } = getConfusedWordsTiming(audioBuffers, playbackRates);
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  // Chrome can retain only the first frame from a detached canvas stream on a
  // longer recording. Keep this implementation canvas off-screen but attached
  // for the full capture lifetime, then remove it during cleanup.
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;pointer-events:none;opacity:0";
  document.body.append(canvas);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_not_supported");

  const destination = audioContext.createMediaStreamDestination();
  // The fixed capture rate gives MediaRecorder monotonically timed frames.
  // Manual requestFrame() frames caused later phases to reuse stale video
  // timestamps even though the canvas itself had advanced correctly.
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
    const gain = audioContext.createGain();
    source.buffer = buffer;
    source.playbackRate.value = playbackRates[index]!;
    source.connect(gain);
    gain.connect(destination);
    const sourceStart = startTime + starts[index]!;
    const sourceDuration = buffer.duration / playbackRates[index]!;
    const fadeDuration = Math.min(AUDIO_CROSSFADE_SECONDS, sourceDuration / 3);
    if (index > 0) {
      gain.gain.setValueAtTime(0, sourceStart);
      gain.gain.linearRampToValueAtTime(1, sourceStart + fadeDuration);
    } else {
      gain.gain.setValueAtTime(1, sourceStart);
    }
    if (index < audioBuffers.length - 1) {
      gain.gain.setValueAtTime(1, sourceStart + Math.max(fadeDuration, sourceDuration - fadeDuration));
      gain.gain.linearRampToValueAtTime(0, sourceStart + sourceDuration);
    }
    source.start(sourceStart);
  });

  let renderTimer: number | null = null;
  const drawFrame = () => {
    const elapsed = Math.min(durationSeconds, Math.max(0, audioContext.currentTime - startTime));
    drawConfusedWordsFrame(context, assets, scenes, starts, durationSeconds, elapsed);
  };

  recorder.start(250);
  drawFrame();
  renderTimer = window.setInterval(drawFrame, 1000 / 30);
  window.setTimeout(() => {
    if (renderTimer !== null) window.clearInterval(renderTimer);
    drawFrame();
    if (recorder.state !== "inactive") recorder.stop();
  }, (durationSeconds + 0.12) * 1000);

  try {
    return await complete;
  } finally {
    if (renderTimer !== null) window.clearInterval(renderTimer);
    stream.getTracks().forEach((track) => track.stop());
    destination.disconnect();
    canvas.remove();
    await releaseMusicVideoAudioContext(audioContext);
  }
}

/** Frame-exact Confused Words export on Chrome/Android, with a legacy fallback. */
export async function renderConfusedWordsVideo(options: ConfusedWordsVideoRenderOptions) {
  if (!options.scenes.length || options.scenes.length % MASCOT_BY_PHASE_SCENE.length !== 0) throw new Error("invalid_video_scene_count");
  const phasePairs = resolvePhasePairs(options);
  const phaseCount = options.scenes.length / MASCOT_BY_PHASE_SCENE.length;
  if (phasePairs.length < phaseCount && !options.cardImageUrls?.length && !options.firstCardImageUrl && !options.secondCardImageUrl) {
    throw new Error("confused_words_cards_unavailable");
  }
  if (await canRenderConfusedWordsDeterministically()) {
    return await renderDeterministicConfusedWordsVideo(options);
  }
  if (!isRealtimeAudioContext(options.audioContext)) throw new Error("browser_video_realtime_audio_required");
  return await renderRealtimeConfusedWordsVideo({ ...options, audioContext: options.audioContext });
}
