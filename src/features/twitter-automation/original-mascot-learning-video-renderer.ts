import { AudioBufferSource, BufferTarget, CanvasSource, canEncodeAudio, canEncodeVideo, Output, WebMOutputFormat } from "mediabunny";
import { releaseMusicVideoAudioContext } from "@/features/twitter-automation/automation-music-video-audio-session";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import type { OriginalMascotLearningVideoScene } from "@/features/twitter-automation/original-mascot-learning-video";
import type { LanguageCode } from "@/types/domain";

type OriginalMascotLearningVideoRenderOptions = {
  audioContext: BaseAudioContext;
  scenes: readonly OriginalMascotLearningVideoScene[];
  language?: LanguageCode;
  nativeLanguage?: LanguageCode;
};

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const SCENE_GAP_SECONDS = 0.2;
const COUNTDOWN_SECONDS = 6;
const TIER_COLORS = { A1: "#00d9b0", A2: "#00b4ff", B1: "#9f6cff", B2: "#ffcc00", C1: "#ff4d6d" } as const;
const FRAME_RATE = 30;
const VIDEO_BITRATE = 4_500_000;
const AUDIO_BITRATE = 128_000;
const QUIZ_OPTION_COLORS = ["#ef4444", "#3b82f6", "#fbbf24", "#10b981"] as const;
const QUIZ_OPTION_TEXT_COLORS = ["#ffffff", "#ffffff", "#17120e", "#ffffff"] as const;
const QUIZ_REVEAL_RED = "#ef4444";
const QUIZ_REVEAL_GREEN = "#10b981";
const QUIZ_COUNTDOWN_Y = 1550;
const MASCOT_NORMAL_Y = 1320;
const MASCOT_PROGRESSION_Y = 1100;
const QUIZ_SUBTITLE_Y = 360;
const QUIZ_TERM_Y = 480;
const OUTRO_Y = 760;
const PROGRESSION_SUBTITLE_Y = 960;
const MASCOT_SENTENCE_TRANSLATION_Y = 1120;
const MASCOT_SENTENCE_TRANSLATION_WIDTH = 920;
const MASCOT_SENTENCE_TRANSLATION_HEIGHT = 1000;
const FLAG_SIZE = 96;

function easeInOutCubic(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function lerpHex(from: string, to: string, progress: number) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const p = Math.max(0, Math.min(1, progress));
  const r = Math.round(a.r + (b.r - a.r) * p);
  const g = Math.round(a.g + (b.g - a.g) * p);
  const b2 = Math.round(a.b + (b.b - a.b) * p);
  return `rgb(${r}, ${g}, ${b2})`;
}

function smoothRevealProgress(localElapsed: number, duration = 0.6) {
  return Math.max(0, Math.min(1, localElapsed / duration));
}

type PreparedSplash = { image: HTMLCanvasElement; orangeImage: HTMLCanvasElement; width: number; height: number };
type OriginalMascotVideoAssets = {
  original: HTMLImageElement;
  mascot4: HTMLImageElement;
  mascot18: HTMLImageElement;
  speaker: HTMLImageElement | null;
  learningFlag: HTMLImageElement | null;
  nativeFlag: HTMLImageElement | null;
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
  // Tint on an isolated transparent canvas. Compositing directly on the video
  // canvas would use the white background as the destination and turn the
  // entire splash rectangle orange.
  const orangeImage = document.createElement("canvas");
  orangeImage.width = croppedWidth;
  orangeImage.height = croppedHeight;
  const orangeContext = orangeImage.getContext("2d");
  if (!orangeContext) throw new Error("canvas_not_supported");
  orangeContext.drawImage(image, 0, 0);
  orangeContext.globalCompositeOperation = "source-in";
  orangeContext.fillStyle = "#f76808";
  orangeContext.fillRect(0, 0, croppedWidth, croppedHeight);
  return { image, orangeImage, width: croppedWidth, height: croppedHeight };
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

function drawHeader(context: CanvasRenderingContext2D, splash: PreparedSplash, subtitle: string, variant: "progression" | "quiz" | "default" = "default") {
  const isQuiz = variant === "quiz";
  const isProgression = variant === "progression";
  const splashWidth = isQuiz ? 720 : isProgression ? 520 : 320;
  const splashHeight = splashWidth * splash.height / splash.width;
  const x = (CANVAS_WIDTH - splashWidth) / 2;
  const y = isQuiz ? 120 : isProgression ? 120 : 44;
  context.drawImage(isQuiz || isProgression ? splash.orangeImage : splash.image, x, y, splashWidth, splashHeight);
  if (!subtitle) return;
  context.textAlign = "center";
  context.textBaseline = "middle";
  if (isQuiz) {
    context.fillStyle = "#17120e";
    context.font = "700 56px Manrope, Arial, sans-serif";
    drawCenteredLines(context, wrapText(context, subtitle, 700, 3), CANVAS_WIDTH / 2, QUIZ_SUBTITLE_Y, 68);
  } else {
    context.fillStyle = "#f5f5f4";
    context.font = "600 48px Manrope, Arial, sans-serif";
    drawCenteredLines(context, wrapText(context, subtitle, 860), CANVAS_WIDTH / 2, 198, 62);
  }
}

function drawMascot(context: CanvasRenderingContext2D, image: HTMLImageElement, elapsed: number, speaking: boolean, targetYBase: number, extraOffsetY = 0, extraAlpha = 1, maxWidth = 780, maxHeight = 880) {
  const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const targetY = targetYBase + Math.max(0, (maxHeight - height) / 2);
  const startY = CANVAS_HEIGHT + 80;
  const y = startY + (targetY - startY) * easeOutQuint(elapsed / 0.86) + extraOffsetY;
  context.save();
  context.globalAlpha = Math.min(1, 0.2 + easeOutQuint(elapsed / 0.55) * 0.8) * extraAlpha;
  context.drawImage(image, (CANVAS_WIDTH - width) / 2, y, width, height);
  context.restore();
}

function drawProgression(context: CanvasRenderingContext2D, scene: Extract<OriginalMascotLearningVideoScene, { kind: "progression" }>, elapsed: number) {
  const rowY = 292;
  const rowHeight = 132;
  const gap = 172;
  const baseWidth = 880;
  scene.terms.forEach((entry, index) => {
    const active = scene.activeTier === entry.tier;
    const targetScale = active ? 1.06 : 1;
    const currentScale = 1 + (targetScale - 1) * easeOutQuint(Math.min(1, elapsed / 0.4));
    const centerX = CANVAS_WIDTH / 2;
    const centerY = rowY + index * gap + rowHeight / 2;
    context.save();
    context.translate(centerX, centerY);
    context.scale(currentScale, currentScale);
    drawRoundedRect(context, -baseWidth / 2, -rowHeight / 2, baseWidth, rowHeight, 24, TIER_COLORS[entry.tier]);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillStyle = "#ffffff";
    context.font = "700 48px Manrope, Arial, sans-serif";
    context.fillText(entry.tier, -baseWidth / 2 + 42, 0);
    context.fillStyle = active ? "#fffaf4" : "#f5f5f4";
    context.font = "600 60px Manrope, Arial, sans-serif";
    context.fillText(entry.term, -baseWidth / 2 + 176, 0);
    context.restore();
  });
}

function drawProgressionSubtitle(context: CanvasRenderingContext2D, subtitle: string) {
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#f76808";
  context.font = "700 50px Manrope, Arial, sans-serif";
  drawCenteredLines(context, wrapText(context, subtitle, 900), CANVAS_WIDTH / 2, PROGRESSION_SUBTITLE_Y, 60);
}

function drawFlag(context: CanvasRenderingContext2D, flag: HTMLImageElement | null, x: number, y: number) {
  if (!flag) return;
  const aspect = flag.naturalWidth / flag.naturalHeight;
  const width = FLAG_SIZE * aspect;
  const height = FLAG_SIZE;
  context.drawImage(flag, x - width / 2, y - height / 2, width, height);
}

function drawSentenceTranslation(
  context: CanvasRenderingContext2D,
  scene: Extract<OriginalMascotLearningVideoScene, { kind: "sentence-translation" }>,
  assets: OriginalMascotVideoAssets,
) {
  const showRight = scene.phase === "translation" || scene.phase === "comment";
  const rightText = scene.phase === "comment" ? scene.commentPrompt : scene.translation;
  const sentenceX = CANVAS_WIDTH * 0.28;
  const translationX = CANVAS_WIDTH * 0.72;
  const textY = 760;
  const flagY = 540;
  const maxWidth = 460;
  const lineHeight = 86;

  drawFlag(context, assets.learningFlag, sentenceX, flagY);
  drawFlag(context, assets.nativeFlag, translationX, flagY);

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#17120e";
  context.font = "700 68px Manrope, Arial, sans-serif";
  drawCenteredLines(context, wrapText(context, scene.sentence, maxWidth, 4), sentenceX, textY, lineHeight);
  if (showRight) {
    context.fillStyle = "#f76808";
    drawCenteredLines(context, wrapText(context, rightText, maxWidth, 4), translationX, textY, lineHeight);
  }
}

function drawQuiz(context: CanvasRenderingContext2D, scene: Extract<OriginalMascotLearningVideoScene, { kind: "quiz" }>, localElapsed: number) {
  const isQuestion = scene.phase === "question";
  const isCountdown = scene.phase === "countdown";
  const isReveal = scene.phase === "reveal";
  const isExplanation = scene.phase === "explanation";
  const showButtons = !isQuestion;

  const BIG_WORD_Y = 900;
  const TERM_Y = QUIZ_TERM_Y;
  const BIG_FONT = 160;
  const TERM_FONT = 84;
  let termY = TERM_Y;
  let termFont = TERM_FONT;
  let termLineHeight = 92;
  if (isQuestion) {
    termY = BIG_WORD_Y;
    termFont = BIG_FONT;
    termLineHeight = 150;
  } else if (isCountdown) {
    const moveDuration = 0.5;
    const p = Math.min(1, localElapsed / moveDuration);
    const eased = easeInOutCubic(p);
    termFont = BIG_FONT + (TERM_FONT - BIG_FONT) * eased;
    termY = BIG_WORD_Y + (TERM_Y - BIG_WORD_Y) * eased;
    termLineHeight = 150 + (92 - 150) * eased;
  }

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#17120e";
  const termText = scene.language === "en" ? scene.term.toUpperCase() : scene.term;
  const termFontFamily = scene.language === "en" ? '"Super Water", Manrope, Arial, sans-serif' : "Manrope, Arial, sans-serif";
  context.font = `600 ${termFont}px ${termFontFamily}`;
  drawCenteredLines(context, wrapText(context, termText, 900, 2), CANVAS_WIDTH / 2, termY, termLineHeight);

  if (showButtons) {
    let buttonsAlpha = 1;
    if (isCountdown) {
      const p = Math.min(1, localElapsed / 0.5);
      buttonsAlpha = easeInOutCubic(p);
    }
    if (buttonsAlpha > 0) {
      context.save();
      context.globalAlpha = buttonsAlpha;
      scene.options.forEach((option, index) => {
        const reveal = isReveal || isExplanation;
        const correct = index === scene.correctIndex;
        const baseFill = QUIZ_OPTION_COLORS[index]!;
        const baseText = QUIZ_OPTION_TEXT_COLORS[index]!;
        const labels = ["A)", "B)", "C)", "D)"];
        const transition = isReveal ? smoothRevealProgress(localElapsed, 0.6) : isExplanation ? 1 : 0;
        const fill = reveal ? (correct ? lerpHex(baseFill, QUIZ_REVEAL_GREEN, transition) : lerpHex(baseFill, QUIZ_REVEAL_RED, transition)) : baseFill;
        const textColor = reveal ? "#ffffff" : baseText;
        const y = 620 + index * 190;
        drawRoundedRect(context, 100, y, 880, 160, 28, fill);
        context.textAlign = "left";
        context.fillStyle = textColor;
        context.font = "600 60px Manrope, Arial, sans-serif";
        context.fillText(`${labels[index]} ${option}`, 142, y + 84);
      });
      context.restore();
    }
  }

  if (isCountdown) drawClock(context, localElapsed, "quiz", scene.durationSeconds ?? 6);
}

function drawOutro(context: CanvasRenderingContext2D, scene: Extract<OriginalMascotLearningVideoScene, { kind: "outro" }>, localElapsed: number) {
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#17120e";
  const fontSize = 72;
  const lineHeight = 92;
  context.font = `700 ${fontSize}px Manrope, Arial, sans-serif`;
  const y = OUTRO_Y;
  scene.lines.forEach((line, index) => {
    context.fillText(line, CANVAS_WIDTH / 2, y + (index - (scene.lines.length - 1) / 2) * lineHeight);
  });
}

function drawClock(context: CanvasRenderingContext2D, elapsed: number, variant: "quiz" | "default" = "default", duration = 5) {
  const remaining = Math.max(0, duration - elapsed);
  const progress = Math.min(1, elapsed / duration);
  const x = CANVAS_WIDTH / 2;
  const y = variant === "quiz" ? QUIZ_COUNTDOWN_Y : 1120;
  const radius = variant === "quiz" ? 160 : 96;
  const lineWidth = variant === "quiz" ? 22 : 16;
  const fontSize = variant === "quiz" ? 120 : 64;
  const bgStroke = variant === "quiz" ? "#e5e5e5" : "#292524";
  const progressStroke = variant === "quiz" ? "#f76808" : "#f5ac27";
  const textFill = variant === "quiz" ? "#17120e" : "#fffaf4";
  context.save();
  context.lineWidth = lineWidth;
  context.strokeStyle = bgStroke;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = progressStroke;
  context.beginPath();
  context.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - progress));
  context.stroke();
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = textFill;
  context.font = `600 ${fontSize}px Manrope, Arial, sans-serif`;
  context.fillText(String(Math.max(0, Math.ceil(remaining))), x, y + 3);
  context.restore();
}

function drawSentence(context: CanvasRenderingContext2D, scene: Extract<OriginalMascotLearningVideoScene, { kind: "sentence" }>, localElapsed: number) {
  const isQuestion = scene.phase === "question";
  const isCountdown = scene.phase === "countdown";
  const isReveal = scene.phase === "reveal" || scene.phase === "explanation";
  const countdownDuration = scene.durationSeconds ?? 5;
  const SENTENCE_FONT = 110;
  const SENTENCE_Y = 620;
  const SENTENCE_LINE_HEIGHT = 126;

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#17120e";
  context.font = `600 ${SENTENCE_FONT}px Manrope, Arial, sans-serif`;
  drawCenteredLines(context, wrapText(context, scene.sentence, 980, 3), CANVAS_WIDTH / 2, SENTENCE_Y, SENTENCE_LINE_HEIGHT);

  if (isCountdown) {
    drawClock(context, localElapsed, "quiz", countdownDuration);
  }

  if (isReveal) {
    context.fillStyle = scene.isCorrect ? "#10b981" : "#ef4444";
    context.font = "700 80px Manrope, Arial, sans-serif";
    drawCenteredLines(context, wrapText(context, scene.subtitle, 980, 2), CANVAS_WIDTH / 2, 800, 92);
    if (scene.correction) {
      context.fillStyle = "#10b981";
      context.font = "600 56px Manrope, Arial, sans-serif";
      drawCenteredLines(context, wrapText(context, scene.correction, 980, 3), CANVAS_WIDTH / 2, 940, 72);
    }
  }
}

function scheduleCountdownTicks(context: BaseAudioContext, destination: AudioNode, startTime: number, duration: number) {
  for (let index = 0; index < Math.floor(duration); index += 1) {
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
  const isProgression = scene.kind === "progression";
  const isQuiz = scene.kind === "quiz";
  const isOutro = scene.kind === "outro";
  const isSentence = scene.kind === "sentence";
  const isSentenceTranslation = scene.kind === "sentence-translation";
  context.fillStyle = isProgression || isQuiz || isOutro || isSentence || isSentenceTranslation ? "#ffffff" : "#090909";
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (!isProgression && !isQuiz && !isOutro && !isSentence && !isSentenceTranslation) {
    context.fillStyle = "#14110e";
    context.beginPath();
    context.ellipse(CANVAS_WIDTH / 2, 1460, 640, 520, 0, 0, Math.PI * 2);
    context.fill();
  }
  drawHeader(context, assets.splash, isProgression ? "" : isSentenceTranslation ? "" : scene.subtitle, isProgression ? "progression" : isQuiz || isOutro || isSentence || isSentenceTranslation ? "quiz" : "default");
  if (isProgression) {
    drawProgression(context, scene, localElapsed);
    drawProgressionSubtitle(context, scene.subtitle);
  }
  if (isQuiz) drawQuiz(context, scene, localElapsed);
  if (scene.kind === "sentence") drawSentence(context, scene, localElapsed);
  if (isOutro) drawOutro(context, scene, localElapsed);
  if (isSentenceTranslation) drawSentenceTranslation(context, scene, assets);
  const mascot = scene.kind === "progression"
    ? assets[scene.mascot]
    : scene.kind === "sentence-translation"
      ? (scene.phase === "sentence" ? assets.speaker ?? assets.original : assets.original)
      : assets.original;
  let mascotOffsetY = 0;
  let mascotAlpha = 1;
  const isCountdownScene = (isQuiz || isSentence) && scene.phase === "countdown";
  if (isCountdownScene) {
    const countdownDuration = scene.durationSeconds ?? (isQuiz ? 6 : 5);
    const hideDuration = 0.5;
    const showStart = countdownDuration - hideDuration;
    if (localElapsed < hideDuration) {
      const p = easeInOutCubic(localElapsed / hideDuration);
      mascotOffsetY = 300 * p;
      mascotAlpha = 1 - p;
    } else if (localElapsed > showStart) {
      const p = easeInOutCubic((localElapsed - showStart) / hideDuration);
      mascotOffsetY = 300 * (1 - p);
      mascotAlpha = p;
    } else {
      mascotOffsetY = 300;
      mascotAlpha = 0;
    }
  }
  const isSentenceTranslationScene = scene.kind === "sentence-translation";
  const mascotTargetY = scene.kind === "progression"
    ? MASCOT_PROGRESSION_Y
    : isSentenceTranslationScene
      ? MASCOT_SENTENCE_TRANSLATION_Y
      : MASCOT_NORMAL_Y;
  drawMascot(
    context,
    mascot,
    clampedElapsed,
    Boolean(scene.audioDataUrl),
    mascotTargetY,
    mascotOffsetY,
    mascotAlpha,
    isSentenceTranslationScene ? MASCOT_SENTENCE_TRANSLATION_WIDTH : undefined,
    isSentenceTranslationScene ? MASCOT_SENTENCE_TRANSLATION_HEIGHT : undefined,
  );
}

function getSpeakerMascotSource(scenes: readonly OriginalMascotLearningVideoScene[]) {
  const scene = scenes.find((scene): scene is Extract<OriginalMascotLearningVideoScene, { kind: "sentence-translation" }> => scene.kind === "sentence-translation");
  return scene ? `/mascot-variations/${encodeURIComponent(scene.speakerMascot)}` : null;
}

function getFlagSource(language?: LanguageCode) {
  const flagCode = language ? LANGUAGE_BY_CODE[language]?.flagCode : null;
  return flagCode ? `/flags/4x3/${flagCode}.svg` : null;
}

async function loadOriginalMascotVideoAssets(scenes: readonly OriginalMascotLearningVideoScene[], language?: LanguageCode, nativeLanguage?: LanguageCode): Promise<OriginalMascotVideoAssets> {
  const speakerSource = getSpeakerMascotSource(scenes);
  const learningFlagSource = getFlagSource(language);
  const nativeFlagSource = getFlagSource(nativeLanguage);
  const [original, mascot4, mascot18, splash, speaker, learningFlag, nativeFlag] = await Promise.all([
    loadImage("/mascot-variations/Original.png"),
    loadImage("/mascots/mascot4.webp"),
    loadImage("/mascots/mascot18.png"),
    loadImage("/splash.png"),
    speakerSource ? loadImage(speakerSource) : Promise.resolve(null),
    learningFlagSource ? loadImage(learningFlagSource) : Promise.resolve(null),
    nativeFlagSource ? loadImage(nativeFlagSource) : Promise.resolve(null),
  ]);
  // Ensure the Super Water display font is loaded before drawing so the first
  // frames do not fall back to a system font.
  if (document.fonts) {
    await document.fonts.load('600 160px "Super Water"').catch(() => undefined);
  }
  return { original, mascot4, mascot18, speaker, learningFlag, nativeFlag, splash: prepareSplash(splash) };
}

async function decodeOriginalMascotAudio(audioContext: BaseAudioContext, scenes: readonly OriginalMascotLearningVideoScene[]) {
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
      scheduleCountdownTicks(offlineContext, offlineContext.destination, starts[index]!, scene.durationSeconds ?? 5);
    }
  });
  return await offlineContext.startRendering();
}

export async function canRenderOriginalMascotDeterministically() {
  if (typeof OfflineAudioContext === "undefined") return false;
  return await canEncodeVideo("vp8", { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, bitrate: VIDEO_BITRATE })
    && await canEncodeAudio("opus", { numberOfChannels: 2, sampleRate: 48_000, bitrate: AUDIO_BITRATE });
}

async function renderDeterministicOriginalMascotLearningVideo({ audioContext, scenes, language, nativeLanguage }: OriginalMascotLearningVideoRenderOptions) {
  const [assets, buffers] = await Promise.all([
    loadOriginalMascotVideoAssets(scenes, language, nativeLanguage),
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
    await releaseMusicVideoAudioContext(audioContext);
  }
}

/** Legacy real-time renderer for browsers without WebCodecs. */
type RealtimeOriginalMascotLearningVideoRenderOptions = Omit<OriginalMascotLearningVideoRenderOptions, "audioContext"> & { audioContext: AudioContext };

function isRealtimeAudioContext(audioContext: BaseAudioContext): audioContext is AudioContext {
  return "createMediaStreamDestination" in audioContext && typeof audioContext.createMediaStreamDestination === "function";
}

async function renderRealtimeOriginalMascotLearningVideo({ audioContext, scenes, language, nativeLanguage }: RealtimeOriginalMascotLearningVideoRenderOptions) {
  if (!HTMLCanvasElement.prototype.captureStream || typeof MediaRecorder === "undefined") throw new Error("video_not_supported");
  if (scenes.length < 2 || scenes.length > 20) throw new Error("invalid_video_scene_count");

  const assets = await loadOriginalMascotVideoAssets(scenes, language, nativeLanguage);
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
    if ((scene.kind === "quiz" || scene.kind === "sentence") && scene.phase === "countdown") scheduleCountdownTicks(audioContext, destination, startTime + starts[index]!, scene.durationSeconds ?? 5);
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
    await releaseMusicVideoAudioContext(audioContext);
  }
}

/** Browser-only 9:16 renderer with frame-exact WebCodecs export on Chrome/Android. */
export async function renderOriginalMascotLearningVideo(options: OriginalMascotLearningVideoRenderOptions) {
  if (options.scenes.length < 2 || options.scenes.length > 20) throw new Error("invalid_video_scene_count");
  if (await canRenderOriginalMascotDeterministically()) {
    return await renderDeterministicOriginalMascotLearningVideo(options);
  }
  if (!isRealtimeAudioContext(options.audioContext)) throw new Error("browser_video_realtime_audio_required");
  return await renderRealtimeOriginalMascotLearningVideo({ ...options, audioContext: options.audioContext });
}
