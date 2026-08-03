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
  audioContext: AudioContext;
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
const SCENE_GAP_SECONDS = 0.18;
const CARD_WIDTH = 430;
const CARD_Y = 360;
const CARD_HIGHLIGHT_SCALE = 1.075;
const CARD_TRANSITION_SECONDS = 0.32;

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

function drawTintedSplash(context: CanvasRenderingContext2D, splash: HTMLImageElement) {
  const width = 520;
  const height = splash.naturalHeight ? width * splash.naturalHeight / splash.naturalWidth : 150;
  const x = (CANVAS_WIDTH - width) / 2;
  const y = 42;
  const mask = document.createElement("canvas");
  mask.width = Math.ceil(width);
  mask.height = Math.ceil(height);
  const maskContext = mask.getContext("2d");
  if (!maskContext) throw new Error("canvas_not_supported");
  maskContext.drawImage(splash, 0, 0, mask.width, mask.height);
  maskContext.globalCompositeOperation = "source-in";
  maskContext.fillStyle = "#f97316";
  maskContext.fillRect(0, 0, mask.width, mask.height);
  context.drawImage(mask, x, y, width, height);
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

export async function renderConfusedWordsVideo(options: ConfusedWordsVideoRenderOptions) {
  const { audioContext, cardImageUrls, firstCardImageUrl, secondCardImageUrl, scenes } = options;
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") throw new Error("video_not_supported");
  if (!scenes.length || scenes.length % 8 !== 0) throw new Error("invalid_video_scene_count");
  const phasePairs = resolvePhasePairs(options);
  const phaseCount = Math.max(...scenes.map((scene) => scene.phaseIndex ?? 0)) + 1;
  if (phasePairs.length < phaseCount && !cardImageUrls?.length && !firstCardImageUrl && !secondCardImageUrl) throw new Error("confused_words_cards_unavailable");

  const normalizedCardUrls = cardImageUrls?.length ? cardImageUrls : [firstCardImageUrl, secondCardImageUrl].filter((url): url is string => Boolean(url));
  const [splash, mascot3, mascot4, mascot18, ...cardImages] = await Promise.all([
    loadImage("/splash.png"),
    loadImage("/mascots/mascot3.webp"),
    loadImage("/mascots/mascot4.webp"),
    loadImage("/mascots/mascot18.png"),
    ...normalizedCardUrls.map((url) => loadImage(url)),
  ]);
  const audioBuffers = await Promise.all(scenes.map(async (scene) => {
    const response = await fetch(scene.audioDataUrl);
    if (!response.ok) throw new Error("speech_load_failed");
    return await audioContext.decodeAudioData(await response.arrayBuffer());
  }));
  const mascots = { 3: mascot3, 4: mascot4, 18: mascot18 } as const;
  const playbackRates = scenes.map((scene) => scene.playbackRate ?? 1);
  let elapsedSeconds = 0;
  const starts = audioBuffers.map((buffer, index) => {
    const start = elapsedSeconds;
    elapsedSeconds += buffer.duration / playbackRates[index]! + SCENE_GAP_SECONDS;
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
    source.playbackRate.value = playbackRates[index]!;
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
    const phaseIndex = scene.phaseIndex ?? 0;
    const previousScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
    const transitionProgress = easeOutQuint((elapsed - starts[sceneIndex]!) / CARD_TRANSITION_SECONDS);
    const highlightedSide = scene.mirrored ? "left" : "right";
    const previousHighlightedSide = previousScene && (previousScene.phaseIndex ?? 0) === phaseIndex
      ? previousScene.mirrored ? "left" : "right"
      : null;
    const cardScale = (side: "left" | "right") => {
      const from = previousHighlightedSide === side ? CARD_HIGHLIGHT_SCALE : 1;
      const to = highlightedSide === side ? CARD_HIGHLIGHT_SCALE : 1;
      return from + (to - from) * transitionProgress;
    };
    const pair = phasePairs[phaseIndex] ?? phasePairs[0];
    const firstCardImage = cardImages[phaseIndex * 2] ?? cardImages[0];
    const secondCardImage = cardImages[phaseIndex * 2 + 1] ?? cardImages[1];

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawTintedSplash(context, splash);
    // Draw the non-active card first so the highlighted card sits cleanly on top.
    const drawCard = (side: "left" | "right") => {
      const x = side === "left" ? 80 : 570;
      const cardImage = side === "left" ? firstCardImage : secondCardImage;
      const card = side === "left" ? pair?.first : pair?.second;
      if (cardImage) drawAppCard(context, cardImage, x, cardScale(side));
      else if (card) drawFallbackCard(context, card, x, cardScale(side));
    };
    drawCard(highlightedSide === "left" ? "right" : "left");
    drawCard(highlightedSide);
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
