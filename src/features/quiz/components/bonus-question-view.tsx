"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Loader2, Star } from "lucide-react";
import {
  getBonusCopy,
  getMatchingColumnCopy,
  MATCHING_BONUS_TITLES,
  type BonusQuestion,
  type CategorySortBonusQuestion,
  type ImposterBonusQuestion,
  type MatchingBonusQuestion,
  type SentenceOrderBonusQuestion,
} from "@/features/quiz/bonus-questions";
import { getBonusQuestionPoints } from "@/features/quiz/bonus-question-constants";
import { MainPointsDisplay } from "@/features/progress/components/main-points-display";
import { RewardScatter } from "@/features/progress/components/reward-scatter";
import { RewardGemHud, type GemHudPulse } from "@/features/progress/components/reward-gem-hud";
import type { GemBalances, GemRewards, GemType } from "@/features/gems/gem-types";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { QuizSkipButton } from "@/features/quiz/components/quiz-skip-button";
import { formatNumber } from "@/i18n/labels";
import { getAiPracticeCharacters } from "@/features/ai-practice/ai-practice-data";
import { speakCardTerm } from "@/features/cards/card-speech";
import type { LanguageCode } from "@/types/domain";
import { QuizMobileActionPortal } from "@/features/quiz/components/quiz-mobile-action-portal";
import {
  QuizWordButton,
  type QuizWordButtonFeedback,
} from "@/features/quiz/components/quiz-word-button";

const SENTENCE_TOKEN_ANIMATION_MS = 360;
const CATEGORY_WORD_ANIMATION_MS = 260;
const BONUS_REWARD_IMAGE = "/quiz/bonus_img.png?v=20261001-1";
const BONUS_INTRO_FRAME_COUNT = 13;
const BONUS_INTRO_FRAME_DURATION_MS = 1_000 / 22;
const BONUS_INTRO_HOLD_DURATION_MS = 800;
const BONUS_INTRO_TEXT_ENTRY_DELAY_MS = 220;
const BONUS_INTRO_TEXT_EXIT_DELAY_MS = 40;
const BONUS_INTRO_TEXT_ANIMATION_DURATION_MS = 230;
const BONUS_INTRO_TEXT_STAGGER_MS = 14;
const BONUS_INTRO_SPRITE_IMAGE = "/quiz/bonus-intro-sprite.png";
const BONUS_INTRO_FRAME_WIDTH = 480;
const BONUS_INTRO_FRAME_HEIGHT = 854;
const BONUS_INTRO_SPRITE_COLUMNS = 4;

type BonusIntroRenderer = {
  drawFrame: (frame: number) => void;
  destroy: () => void;
};

function parseBonusIntroBrandColor(value: string): [number, number, number] {
  const normalized = value.trim();
  const hexMatch = normalized.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hexMatch) {
    const hex = hexMatch[1];
    const fullHex = hex.length === 3 ? hex.split("").map((digit) => `${digit}${digit}`).join("") : hex;
    return [
      Number.parseInt(fullHex.slice(0, 2), 16) / 255,
      Number.parseInt(fullHex.slice(2, 4), 16) / 255,
      Number.parseInt(fullHex.slice(4, 6), 16) / 255,
    ];
  }

  const rgbMatch = normalized.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgbMatch) {
    return [
      Math.min(255, Number(rgbMatch[1])) / 255,
      Math.min(255, Number(rgbMatch[2])) / 255,
      Math.min(255, Number(rgbMatch[3])) / 255,
    ];
  }

  return [0xf7 / 255, 0x68 / 255, 0x08 / 255];
}

function createBonusIntroWebglRenderer(
  canvas: HTMLCanvasElement,
  atlas: HTMLImageElement,
): BonusIntroRenderer | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    stencil: false,
  });
  if (!gl) return null;

  const vertexShaderSource = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    uniform vec2 u_resolution;
    varying vec2 v_texCoord;

    void main() {
      vec2 zeroToOne = a_position / u_resolution;
      vec2 clipSpace = zeroToOne * 2.0 - 1.0;
      gl_Position = vec4(clipSpace * vec2(1.0, -1.0), 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `;
  const fragmentShaderSource = `
    precision mediump float;
    uniform sampler2D u_texture;
    uniform vec4 u_frameRect;
    uniform vec3 u_tint;
    varying vec2 v_texCoord;

    void main() {
      vec2 atlasCoord = u_frameRect.xy + v_texCoord * u_frameRect.zw;
      float alpha = texture2D(u_texture, atlasCoord).a;
      gl_FragColor = vec4(u_tint, alpha);
    }
  `;

  const compileShader = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const texCoordLocation = gl.getAttribLocation(program, "a_texCoord");
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  const frameRectLocation = gl.getUniformLocation(program, "u_frameRect");
  const tintLocation = gl.getUniformLocation(program, "u_tint");
  if (
    positionLocation < 0 ||
    texCoordLocation < 0 ||
    resolutionLocation === null ||
    frameRectLocation === null ||
    tintLocation === null
  ) {
    gl.deleteProgram(program);
    return null;
  }

  const positionBuffer = gl.createBuffer();
  const texCoordBuffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!positionBuffer || !texCoordBuffer || !texture) {
    if (positionBuffer) gl.deleteBuffer(positionBuffer);
    if (texCoordBuffer) gl.deleteBuffer(texCoordBuffer);
    if (texture) gl.deleteTexture(texture);
    gl.deleteProgram(program);
    return null;
  }

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(texCoordLocation);
  gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
  gl.uniform1i(gl.getUniformLocation(program, "u_texture"), 0);
  gl.uniform3fv(
    tintLocation,
    new Float32Array(
      parseBonusIntroBrandColor(
        getComputedStyle(document.documentElement).getPropertyValue("--brand"),
      ),
    ),
  );
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  let lastWidth = 0;
  let lastHeight = 0;

  const drawFrame = (frame: number) => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width <= 0 || height <= 0) return;

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelWidth = Math.max(1, Math.round(width * devicePixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * devicePixelRatio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      gl.viewport(0, 0, pixelWidth, pixelHeight);
    }

    if (width !== lastWidth || height !== lastHeight) {
      lastWidth = width;
      lastHeight = height;
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([0, 0, width, 0, 0, height, width, height]),
        gl.STATIC_DRAW,
      );
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    }

    const scale = Math.max(width / BONUS_INTRO_FRAME_WIDTH, height / BONUS_INTRO_FRAME_HEIGHT);
    const drawWidth = BONUS_INTRO_FRAME_WIDTH * scale;
    const drawHeight = BONUS_INTRO_FRAME_HEIGHT * scale;
    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;
    const atlasColumn = (frame - 1) % BONUS_INTRO_SPRITE_COLUMNS;
    const atlasRow = Math.floor((frame - 1) / BONUS_INTRO_SPRITE_COLUMNS);
    const insetX = 0.5 / atlas.naturalWidth;
    const insetY = 0.5 / atlas.naturalHeight;
    // WebGL's texture origin is at the bottom-left after UNPACK_FLIP_Y_WEBGL.
    // Convert the frame's top-left atlas row to its bottom-based texture Y.
    const atlasFrameBottom =
      1 - ((atlasRow + 1) * BONUS_INTRO_FRAME_HEIGHT) / atlas.naturalHeight;

    gl.uniform2f(resolutionLocation, width, height);
    gl.uniform4f(
      frameRectLocation,
      (atlasColumn * BONUS_INTRO_FRAME_WIDTH) / atlas.naturalWidth + insetX,
      atlasFrameBottom + insetY,
      (BONUS_INTRO_FRAME_WIDTH - 1) / atlas.naturalWidth,
      (BONUS_INTRO_FRAME_HEIGHT - 1) / atlas.naturalHeight,
    );
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const destroy = () => {
    gl.deleteTexture(texture);
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(texCoordBuffer);
    gl.deleteProgram(program);
  };

  return { drawFrame, destroy };
}

function createBonusIntroCanvasRenderer(
  canvas: HTMLCanvasElement,
  atlas: HTMLImageElement,
): BonusIntroRenderer | null {
  const context = canvas.getContext("2d", { alpha: true, desynchronized: true });
  if (!context) return null;

  const tintCanvas = document.createElement("canvas");
  tintCanvas.width = atlas.naturalWidth;
  tintCanvas.height = atlas.naturalHeight;
  const tintContext = tintCanvas.getContext("2d", { alpha: true });
  if (!tintContext) return null;

  tintContext.drawImage(atlas, 0, 0);
  tintContext.globalCompositeOperation = "source-in";
  tintContext.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#f76808";
  tintContext.fillRect(0, 0, tintCanvas.width, tintCanvas.height);
  tintContext.globalCompositeOperation = "source-over";
  context.imageSmoothingEnabled = true;

  const drawFrame = (frame: number) => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width <= 0 || height <= 0) return;

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelWidth = Math.max(1, Math.round(width * devicePixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * devicePixelRatio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.imageSmoothingEnabled = true;
    }

    const scale = Math.max(width / BONUS_INTRO_FRAME_WIDTH, height / BONUS_INTRO_FRAME_HEIGHT);
    const drawWidth = BONUS_INTRO_FRAME_WIDTH * scale;
    const drawHeight = BONUS_INTRO_FRAME_HEIGHT * scale;
    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;
    const atlasColumn = (frame - 1) % BONUS_INTRO_SPRITE_COLUMNS;
    const atlasRow = Math.floor((frame - 1) / BONUS_INTRO_SPRITE_COLUMNS);

    context.clearRect(0, 0, width, height);
    context.drawImage(
      tintCanvas,
      atlasColumn * BONUS_INTRO_FRAME_WIDTH,
      atlasRow * BONUS_INTRO_FRAME_HEIGHT,
      BONUS_INTRO_FRAME_WIDTH,
      BONUS_INTRO_FRAME_HEIGHT,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );
  };

  return { drawFrame, destroy: () => undefined };
}

const CATEGORY_SORT_PALETTES = [
  {
    background: "bg-emerald-500",
  },
  {
    background: "bg-sky-500",
  },
  {
    background: "bg-rose-500",
  },
] as const;

export function BonusQuestionIntro({ onComplete }: { onComplete: () => void }) {
  const { locale } = useLocale();
  const copy = getBonusCopy(locale);
  const introText = formatSuperWaterText(locale, copy.intro);
  const spriteRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    let frameTimer: number | null = null;
    let animationFrame: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;
    let renderer: BonusIntroRenderer | null = null;
    let cancelled = false;
    let currentFrame = 1;

    const complete = () => {
      if (cancelled) return;
      if (completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current();
    };

    const updatePhase = (phase: "opening" | "holding" | "closing") => {
      const sprite = spriteRef.current;
      if (!sprite) return;
      sprite.dataset.bonusIntroPhase = phase;
      sprite.style.transform = phase === "closing" ? "scaleY(-1)" : "";
    };

    const loadImage = async () => {
      const image = new window.Image();
      image.decoding = "async";
      image.src = BONUS_INTRO_SPRITE_IMAGE;

      if (typeof image.decode === "function") {
        await image.decode().catch(() => undefined);
      }

      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }

      return image;
    };

    const prepareAndAnimate = async () => {
      const canvas = canvasRef.current;
      const sprite = spriteRef.current;
      if (!canvas || !sprite) return;

      const atlas = await loadImage();
      if (cancelled || atlas.naturalWidth === 0 || atlas.naturalHeight === 0) return;

      const activeRenderer =
        createBonusIntroWebglRenderer(canvas, atlas) ?? createBonusIntroCanvasRenderer(canvas, atlas);
      if (!activeRenderer) return;
      renderer = activeRenderer;

      const drawFrame = (nextFrame: number) => {
        activeRenderer.drawFrame(nextFrame);
        sprite.dataset.bonusIntroFrame = String(nextFrame);
      };

      const resize = () => drawFrame(currentFrame);
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
      } else {
        resizeHandler = resize;
        window.addEventListener("resize", resizeHandler);
      }

      const startClosing = () => {
        if (cancelled) return;
        updatePhase("closing");
        currentFrame = BONUS_INTRO_FRAME_COUNT;
        drawFrame(currentFrame);

        const closingStartedAt = performance.now();
        const closingDuration = Math.max(
          (BONUS_INTRO_FRAME_COUNT - 1) * BONUS_INTRO_FRAME_DURATION_MS,
          BONUS_INTRO_TEXT_EXIT_DELAY_MS +
            BONUS_INTRO_TEXT_ANIMATION_DURATION_MS +
            Math.max(0, Array.from(introText).length - 1) * BONUS_INTRO_TEXT_STAGGER_MS,
        );
        const animateClosing = (now: number) => {
          if (cancelled) return;

          const nextFrame = Math.max(
            1,
            BONUS_INTRO_FRAME_COUNT - Math.floor((now - closingStartedAt) / BONUS_INTRO_FRAME_DURATION_MS),
          );
          if (nextFrame !== currentFrame) {
            currentFrame = nextFrame;
            drawFrame(currentFrame);
          }

          if (currentFrame <= 1 && now - closingStartedAt >= closingDuration) {
            complete();
            return;
          }

          animationFrame = window.requestAnimationFrame(animateClosing);
        };

        animationFrame = window.requestAnimationFrame(animateClosing);
      };

      const openingStartedAt = performance.now();
      const animateOpening = (now: number) => {
        if (cancelled) return;

        const nextFrame = Math.min(
          BONUS_INTRO_FRAME_COUNT,
          1 + Math.floor((now - openingStartedAt) / BONUS_INTRO_FRAME_DURATION_MS),
        );
        if (nextFrame !== currentFrame) {
          currentFrame = nextFrame;
          drawFrame(currentFrame);
        }

        if (currentFrame >= BONUS_INTRO_FRAME_COUNT) {
          updatePhase("holding");
          frameTimer = window.setTimeout(startClosing, BONUS_INTRO_HOLD_DURATION_MS);
          return;
        }

        animationFrame = window.requestAnimationFrame(animateOpening);
      };

      drawFrame(currentFrame);
      animationFrame = window.requestAnimationFrame(animateOpening);
    };

    void prepareAndAnimate();

    return () => {
      cancelled = true;
      if (frameTimer !== null) window.clearTimeout(frameTimer);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      renderer?.destroy();
    };
  }, [introText]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-[var(--background)] text-[var(--foreground)]"
      data-bonus-question-intro
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        ref={spriteRef}
        data-bonus-intro-sprite
        data-bonus-intro-frame="1"
        data-bonus-intro-phase="opening"
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
      </div>
      <span
        className={cn(
          "relative z-[1] px-6 text-center text-4xl font-bold sm:text-6xl",
          canUseSuperWater(locale) && "font-super-water",
        )}
        data-bonus-intro-text
        aria-label={introText}
      >
        {Array.from(introText).map((character, index) => (
          <span
            key={`${character}-${index}`}
            aria-hidden="true"
            style={{ "--bonus-intro-character-index": index } as CSSProperties}
          >
            {character === " " ? "\u00a0" : character}
          </span>
        ))}
      </span>
    </div>,
    document.body,
  );
}

export function BonusQuestionView({
  question,
  language = "en",
  showingAnswer,
  answerAccepted,
  wasSkipped = false,
  canAdvance = true,
  onSubmit,
  onSkip,
  onNext,
  onFlightStart,
  onPointArrive,
  onFlightComplete,
  rewardReady = true,
  showPointFlight = true,
  totalPoints = 0,
  scorePulse = 0,
  gemBalances,
  gemPulse,
  gemRewards,
  onGemArrive,
  onGemFlightComplete,
  rewardRevealVisible = false,
  onRewardCollect,
}: {
  question: BonusQuestion;
  language?: LanguageCode;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
  wasSkipped?: boolean;
  canAdvance?: boolean;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
  onNext: () => void;
  onFlightStart?: () => void;
  onPointArrive?: (points: number) => void;
  onFlightComplete?: () => void;
  rewardReady?: boolean;
  showPointFlight?: boolean;
  totalPoints?: number;
  scorePulse?: number;
  gemBalances?: GemBalances | null;
  gemPulse?: GemHudPulse | null;
  gemRewards?: GemRewards | null;
  onGemArrive?: (type: GemType) => void;
  onGemFlightComplete?: () => void;
  rewardRevealVisible?: boolean;
  onRewardCollect?: () => void;
}) {
  const { locale, t } = useLocale();
  const copy = getBonusCopy(locale);
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const points = getBonusQuestionPoints(question.kind);
  const isSentenceOrder = question.kind === "sentence-order";
  const [sentenceDecorationMounted] = useState(true);
  const [rewardRevealCollected, setRewardRevealCollected] = useState(false);
  const [sentenceDecorationCharacter] = useState(() => {
    const characters = getAiPracticeCharacters();
    return characters[Math.floor(Math.random() * characters.length)] ?? characters[0]!;
  });
  const rewardDelivered = rewardRevealCollected && showingAnswer && answerAccepted === true && rewardReady;
  const rewardFlightReady = rewardDelivered && (showPointFlight || Boolean(gemRewards?.length));
  const showRewardHud = rewardFlightReady;

  function handleRewardRevealCollect() {
    if (!rewardRevealVisible || rewardRevealCollected) return;
    setRewardRevealCollected(true);
    onRewardCollect?.();
  }

  const sentenceDecoration = isSentenceOrder && sentenceDecorationMounted
    ? (
        <div
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          data-bonus-sentence-decoration-layer
          aria-hidden="true"
        >
          <div
            className="absolute bottom-[15px] left-1/2 h-[min(112vw,36rem)] w-[min(112vw,36rem)] -translate-x-1/2 translate-y-[20%] opacity-25"
            data-bonus-sentence-decoration
          >
            <Image
              src={sentenceDecorationCharacter.imageSrc}
              alt=""
              fill
              sizes="(max-width: 640px) 112vw, 576px"
              className="object-contain"
            />
          </div>
        </div>
      )
    : null;

  const rewardHudContent = showRewardHud ? (
    <div
      className="pointer-events-none flex flex-col items-center justify-center gap-1"
      data-bonus-reward-hud
    >
      <MainPointsDisplay
        className="animate-points-pop"
        pulse={scorePulse}
        data-bonus-reward-score
        valueClassName={cn("text-lg font-bold", canUseSuperWater(locale) && "font-super-water")}
        value={formatSuperWaterText(locale, formatNumber(locale, totalPoints))}
      />
      <RewardGemHud
        animate
        desktopVisible
        hudRole="reward"
        balances={gemBalances}
        pulse={gemPulse}
        superWater={canUseSuperWater(locale)}
      />
    </div>
  ) : null;

  const rewardHudPortal = rewardHudContent && typeof document !== "undefined"
    ? createPortal(
        <div
          className="pointer-events-none fixed inset-x-0 top-5 z-[95] flex justify-center"
          data-bonus-reward-hud-layer
        >
          {rewardHudContent}
        </div>,
        document.body,
      )
    : null;

  const rewardRevealPortal = rewardRevealVisible && typeof document !== "undefined"
    ? createPortal(
        <div
          className="fixed inset-0 z-[80] flex cursor-pointer items-center justify-center overflow-hidden bg-background text-center"
          role="button"
          tabIndex={0}
          aria-label={t("quiz.tapToContinue")}
          data-bonus-reward-reveal
          onClick={handleRewardRevealCollect}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleRewardRevealCollect();
            }
          }}
        >
          <div className="quiz-flow-enter-right flex min-h-full w-full flex-col items-center justify-center gap-5 px-5">
            <div
              ref={sourceRef}
              className="relative aspect-[1536/1000] w-[min(74vw,27rem)] overflow-visible"
              data-bonus-reward-source
              data-bonus-reward-source-state={rewardFlightReady ? "exiting" : "idle"}
              >
                <div
                  className={cn(
                    "bonus-reward-ray-field",
                    rewardRevealCollected && "bonus-reward-ray-field--hidden",
                  )}
                  data-bonus-reward-rays
                  aria-hidden="true"
                >
                  <span className="bonus-reward-ray bonus-reward-ray--yellow" />
                  <span className="bonus-reward-ray bonus-reward-ray--green" />
                  <span className="bonus-reward-ray bonus-reward-ray--purple" />
                  <span className="bonus-reward-ray bonus-reward-ray--blue" />
                </div>
              <Image
                src={BONUS_REWARD_IMAGE}
                alt=""
                width={1536}
                height={1000}
                sizes="(max-width: 640px) 74vw, 432px"
                unoptimized
                priority
                className={cn(
                  "relative z-10 h-auto w-full object-contain",
                  rewardRevealCollected
                    ? "animate-bonus-reward-reveal-exit"
                    : "animate-bonus-reward-reveal-rotate",
                )}
              />
            </div>
          </div>
          {rewardHudPortal}
          {rewardFlightReady
            ? <RewardScatter
                points={showPointFlight ? {
                  amount: points,
                  source: sourceRef,
                  targetSelector: "[data-bonus-reward-score]",
                  placement: { origin: "center" },
                  zIndex: 80,
                } : null}
                gems={{
                  rewards: gemRewards ?? [],
                  source: sourceRef,
                  targetSelector: '[data-reward-gem-hud-role="reward"] [data-reward-gem-target]',
                  placement: { origin: "center" },
                  arrivalSoundEffect: "gem-loot",
                  zIndex: 112,
                }}
                onPointsStart={onFlightStart}
                onPointsArrive={(awardedTotal) => onPointArrive?.(awardedTotal)}
                onPointsComplete={onFlightComplete}
                onGemArrive={onGemArrive}
                onGemsComplete={onGemFlightComplete}
              />
            : null}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={cn(
      "relative isolate z-0 w-full",
      rewardRevealVisible && "quiz-flow-exit-left",
    )}>
      {sentenceDecoration}
      <div
        className="animate-screen-pop relative z-10 flex w-full max-w-2xl flex-col items-center gap-4 overflow-visible rounded-xl bg-transparent px-1 py-2 text-foreground sm:gap-5 sm:px-4"
        data-bonus-question={question.kind}
      >

      <div className="relative z-10 flex flex-col items-center gap-1 text-center">
        <h2
          className={cn(
            question.kind === "sentence-order"
              ? "-translate-y-7 text-4xl font-semibold text-white sm:text-5xl"
              : question.kind === "imposter"
                ? "text-4xl font-semibold text-white sm:text-5xl"
              : question.kind === "category-sort"
                ? "-translate-y-5 text-2xl font-semibold text-white sm:text-3xl"
                : "text-2xl font-semibold text-white sm:text-3xl",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {question.kind === "matching"
            ? formatSuperWaterUppercaseText(locale, MATCHING_BONUS_TITLES[locale])
            : formatSuperWaterText(locale, getBonusTitle(copy, question.kind))}
        </h2>
      </div>

      <div className="relative z-10 flex w-full flex-col items-center">
        {question.kind === "matching" ? (
          <MatchingBonus question={question} language={language} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        ) : question.kind === "sentence-order" ? (
          <SentenceOrderBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        ) : question.kind === "category-sort" ? (
          <CategorySortBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        ) : (
          <ImposterBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        )}
      </div>

      <div className="relative z-10 flex w-full flex-col items-center gap-2">
        <Button
          type="button"
          onClick={onNext}
          disabled={!showingAnswer || !canAdvance}
          className={cn(
            "w-full max-w-sm bg-brand text-brand-foreground hover:bg-brand-hover max-lg:hidden",
            !showingAnswer && "invisible pointer-events-none",
          )}
          data-bonus-next
        >
          {canAdvance ? t("quiz.nextCard") : <Loader2 className="size-5 animate-spin" aria-label={t("quiz.aiValidating")} />}
        </Button>
      </div>

      {rewardRevealPortal}
    </div>
    </div>
  );
}

function MatchingBonus({
  question,
  language,
  showingAnswer,
  answerAccepted,
  onSubmit,
  onSkip,
}: {
  question: MatchingBonusQuestion;
  language: LanguageCode;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
}) {
  const { locale } = useLocale();
  const usesSuperWater = canUseSuperWater(locale);
  const columnCopy = getMatchingColumnCopy(locale);
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [selectedMeaningId, setSelectedMeaningId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [invalidPair, setInvalidPair] = useState<{ termId: string; meaningId: string } | null>(null);
  const [invalidAnimationKey, setInvalidAnimationKey] = useState(0);
  const invalidAnimationTimerRef = useRef<number | null>(null);
  const matchingCompletionSubmittedRef = useRef(false);
  const matchedMeaningIds = new Set(Object.values(matches));
  const allMatchesComplete = Object.keys(matches).length === question.pairs.length;

  useEffect(() => () => {
    if (invalidAnimationTimerRef.current !== null) {
      window.clearTimeout(invalidAnimationTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!allMatchesComplete || showingAnswer || matchingCompletionSubmittedRef.current) return;

    matchingCompletionSubmittedRef.current = true;
    const timer = window.setTimeout(() => {
      onSubmit("matching", true);
    }, MATCHING_CORRECT_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [allMatchesComplete, onSubmit, showingAnswer]);

  function triggerInvalidPair(termId: string, meaningId: string) {
    if (invalidAnimationTimerRef.current !== null) {
      window.clearTimeout(invalidAnimationTimerRef.current);
    }

    setInvalidPair({ termId, meaningId });
    setInvalidAnimationKey((current) => current + 1);
    playSoundEffect("bonus-invalid-operation");
    vibrate("incorrect");
    invalidAnimationTimerRef.current = window.setTimeout(() => {
      setInvalidPair((current) => current?.termId === termId && current.meaningId === meaningId ? null : current);
      invalidAnimationTimerRef.current = null;
    }, MATCHING_INVALID_ANIMATION_MS);
  }

  function completePair(termId: string, meaningId: string) {
    if (invalidAnimationTimerRef.current !== null) {
      window.clearTimeout(invalidAnimationTimerRef.current);
      invalidAnimationTimerRef.current = null;
    }

    setInvalidPair(null);
    setMatches((current) => ({ ...current, [termId]: meaningId }));
    setSelectedTermId(null);
    setSelectedMeaningId(null);
    playSoundEffect("bonus-select");
    vibrate("correct");
    speakMatchedTerm(termId);
  }

  function speakMatchedTerm(termId: string) {
    const term = question.terms.find((pair) => pair.id === termId)?.term;
    if (term) speakCardTerm(term, language);
  }

  function selectTerm(id: string) {
    if (showingAnswer) return;

    if (!selectedMeaningId) {
      vibrate("tap");
      setSelectedTermId(id);
      return;
    }

    const meaningId = selectedMeaningId;
    if (id === meaningId) {
      completePair(id, meaningId);
      return;
    }

    setSelectedTermId(null);
    setSelectedMeaningId(null);
    triggerInvalidPair(id, meaningId);
  }

  function selectMeaning(id: string) {
    if (showingAnswer) return;

    if (!selectedTermId) {
      vibrate("tap");
      setSelectedMeaningId(id);
      return;
    }

    const termId = selectedTermId;
    if (termId === id) {
      completePair(termId, id);
      return;
    }

    setSelectedTermId(null);
    setSelectedMeaningId(null);
    triggerInvalidPair(termId, id);
  }

  return (
    <div className="relative grid w-full grid-cols-2 gap-3 sm:gap-4" data-bonus-matching-board>
      <div className="relative z-10 col-start-2 row-start-1 flex min-w-0 flex-col items-center gap-2">
        <h3 className={cn("h-6 w-full text-center text-sm font-bold leading-6 text-white", usesSuperWater && "font-super-water")}>
          {formatSuperWaterUppercaseText(locale, columnCopy.terms)}
        </h3>
        <div className="flex w-full flex-col items-center gap-3">
         {question.terms.map((pair) => {
           const correct = matches[pair.id] === pair.id;
           const invalid = invalidPair?.termId === pair.id;
           const feedback: QuizWordButtonFeedback | undefined = correct
             ? "correct"
             : invalid
               ? undefined
               : selectedTermId === pair.id
                 ? "selected"
                 : "idle";
          return (
            <QuizWordButton
              key={`term-${pair.id}`}
              type="button"
              disabled={showingAnswer || correct || invalid}
              onClick={() => selectTerm(pair.id)}
              wordType={invalid ? "invalid-operation" : correct ? "correct" : "select"}
              selected={feedback === "selected"}
              feedback={feedback}
              animationTrigger={invalid ? invalidAnimationKey : undefined}
              className={cn(
                "h-[86px] min-h-[86px] w-[calc(100%-0.5rem)] text-lg sm:text-xl",
              )}
              data-bonus-term={pair.id}
              data-bonus-result={feedback ?? "idle"}
            >
              <span className="flex min-w-0 flex-col items-center justify-center leading-tight">
                {pair.term}
              </span>
            </QuizWordButton>
          );
        })}
        </div>
      </div>
      <div className="relative z-10 col-start-1 row-start-1 flex min-w-0 flex-col items-center gap-2">
        <h3 className={cn("h-6 w-full text-center text-sm font-bold leading-6 text-white", usesSuperWater && "font-super-water")}>
          {formatSuperWaterUppercaseText(locale, columnCopy.meanings)}
        </h3>
        <div className="flex w-full flex-col items-center gap-3">
        {question.meanings.map((pair) => {
          const pairedTermId = Object.entries(matches).find(([, meaningId]) => meaningId === pair.id)?.[0];
          const correct = pairedTermId === pair.id;
          const invalid = invalidPair?.meaningId === pair.id;
          const selected = selectedMeaningId === pair.id;
          const feedback: QuizWordButtonFeedback | undefined = correct
            ? "correct"
            : invalid
              ? undefined
              : selected
                ? "selected"
                : "idle";
          return (
            <QuizWordButton
              key={`meaning-${pair.id}`}
              type="button"
              disabled={showingAnswer || correct || invalid}
              onClick={() => selectMeaning(pair.id)}
              wordType={invalid ? "invalid-operation" : correct ? "correct" : "select"}
              selected={feedback === "selected"}
              feedback={feedback}
              animationTrigger={invalid ? invalidAnimationKey : undefined}
              className={cn(
                "h-[86px] min-h-[86px] w-[calc(100%-0.5rem)] text-lg sm:text-xl",
              )}
              data-bonus-meaning={pair.id}
              data-bonus-result={feedback ?? "idle"}
            >
              {pair.meaning}
            </QuizWordButton>
          );
        })}
        </div>
      </div>
      <div className="relative z-10 col-span-2">
        <QuizMobileActionPortal withinTransition>
          <div className="mt-1 flex w-full justify-center" data-quiz-bottom-actions>
            <QuizSkipButton
              className="w-full max-w-sm"
              disabled={showingAnswer}
              onClick={onSkip}
            />
          </div>
        </QuizMobileActionPortal>
      </div>
      <span className="sr-only" data-bonus-answer-state>{answerAccepted === null ? "idle" : answerAccepted ? "correct" : "incorrect"}</span>
      <span className="sr-only">{matchedMeaningIds.size}</span>
    </div>
  );
}

function SentenceOrderBonus({
  question,
  showingAnswer,
  answerAccepted,
  onSubmit,
  onSkip,
}: {
  question: SentenceOrderBonusQuestion;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [displayTokens] = useState(() => shuffleSentenceTokens(question.tokens));
  const [returningTokenId, setReturningTokenId] = useState<string | null>(null);
  const returnAnimationTimerRef = useRef<number | null>(null);
  const selectedSet = new Set(selectedIds);
  const canCheck = selectedIds.length === question.tokens.length;
  const isCorrect = question.acceptedTokenOrders.some(
    (acceptedOrder) => acceptedOrder.length === selectedIds.length && acceptedOrder.every((id, index) => id === selectedIds[index]),
  );

  useEffect(() => () => {
    if (returnAnimationTimerRef.current !== null) {
      window.clearTimeout(returnAnimationTimerRef.current);
    }
  }, []);

  function toggleToken(id: string) {
    if (showingAnswer) return;
    playSoundEffect("bonus-select");

    if (returnAnimationTimerRef.current !== null) {
      window.clearTimeout(returnAnimationTimerRef.current);
      returnAnimationTimerRef.current = null;
    }

    if (selectedIds.includes(id)) {
      setReturningTokenId(id);
      setSelectedIds((current) => current.filter((tokenId) => tokenId !== id));
      returnAnimationTimerRef.current = window.setTimeout(() => {
        setReturningTokenId((current) => current === id ? null : current);
        returnAnimationTimerRef.current = null;
      }, SENTENCE_TOKEN_ANIMATION_MS);
      return;
    }

    setReturningTokenId(null);
    setSelectedIds((current) => current.includes(id) ? current : [...current, id]);
  }

  return (
    <div className="flex w-full flex-col gap-3" data-bonus-sentence-order>
      <div className="-mt-2 min-h-[7.5rem] -translate-y-7 rounded-xl border border-border bg-background-card p-3 text-left" data-bonus-sentence-display>
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id, index) => {
              const token = question.tokens.find((candidate) => candidate.id === id)!;
              const correct = showingAnswer && (
                answerAccepted === true || id === question.tokens[index]?.id
              );
              const feedback: QuizWordButtonFeedback | undefined = showingAnswer
                ? correct
                  ? "correct"
                  : "incorrect"
                : undefined;
              return (
                <QuizWordButton
                  key={id}
                  type="button"
                  disabled={showingAnswer}
                  onClick={() => toggleToken(id)}
                  wordType={showingAnswer ? "inactive" : "select"}
                  selected={!showingAnswer}
                  feedback={feedback}
                  className={cn(
                    "min-h-10",
                    "animate-bonus-sentence-token-enter",
                  )}
                  data-bonus-sentence-selected={id}
                >
                  {token.text}
                </QuizWordButton>
              );
            })}
          </div>
        ) : <span className="text-sm text-foreground-muted">…</span>}
      </div>
      <div className="mt-8 flex translate-y-5 flex-wrap justify-center gap-2">
        {displayTokens.map((token) => (
          <QuizWordButton
            key={token.id}
            type="button"
            disabled={showingAnswer}
            onClick={() => toggleToken(token.id)}
            wordType={showingAnswer ? "inactive" : "select"}
            selected={selectedSet.has(token.id)}
            feedback={showingAnswer ? "muted" : undefined}
            className={cn(
              "min-h-14",
              selectedSet.has(token.id) && "opacity-35",
              returningTokenId === token.id && "animate-bonus-sentence-token-return",
            )}
            data-bonus-sentence-token={token.id}
          >
            {token.text}
          </QuizWordButton>
        ))}
      </div>
      <BonusCheckButton
        disabled={!canCheck || showingAnswer}
        onClick={() => onSubmit("sentence-order", isCorrect)}
        showingAnswer={showingAnswer}
        onSkip={onSkip}
      />
      <span className="sr-only" data-bonus-answer-state>{answerAccepted === null ? "idle" : answerAccepted ? "correct" : "incorrect"}</span>
    </div>
  );
}

function shuffleSentenceTokens<T extends { id: string }>(tokens: T[]) {
  const shuffled = [...tokens];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  // Keep a sentence with two or more words from accidentally rendering in its
  // answer order, while still keeping the order random for every new question.
  if (
    shuffled.length > 1 &&
    shuffled.every((token, index) => token.id === tokens[index]?.id)
  ) {
    [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  }

  return shuffled;
}

function CategorySortBonus({
  question,
  showingAnswer,
  answerAccepted,
  onSubmit,
  onSkip,
}: {
  question: CategorySortBonusQuestion;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
}) {
  const { locale, t } = useLocale();
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [exitingAssignments, setExitingAssignments] = useState<Record<string, string>>({});
  const [returningWordIds, setReturningWordIds] = useState<Record<string, boolean>>({});
  const animationTimersRef = useRef<number[]>([]);
  const categoryByWord = new Map(question.categories.flatMap((category) => category.wordIds.map((wordId) => [wordId, category.id] as const)));
  const canCheck = Object.keys(assignments).length === question.words.length;
  const isCorrect = question.words.every((word) => assignments[word.id] === categoryByWord.get(word.id));

  useEffect(() => {
    return () => {
      animationTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  function selectWord(wordId: string) {
    if (showingAnswer) return;
    playSoundEffect("bonus-select");
    const assignedCategoryId = assignments[wordId];
    if (assignedCategoryId) {
      // A word in a category needs one deliberate tap to return to the word bank.
      // It must not become selected in the same interaction.
      setSelectedWordId(null);
      setExitingAssignments((current) => ({ ...current, [wordId]: assignedCategoryId }));
      setAssignments((current) => {
        const next = { ...current };
        delete next[wordId];
        return next;
      });
      setReturningWordIds((current) => ({ ...current, [wordId]: true }));
      const timer = window.setTimeout(() => {
        setExitingAssignments((current) => {
          const next = { ...current };
          delete next[wordId];
          return next;
        });
        setReturningWordIds((current) => {
          const next = { ...current };
          delete next[wordId];
          return next;
        });
      }, CATEGORY_WORD_ANIMATION_MS);
      animationTimersRef.current.push(timer);
      return;
    }
    setSelectedWordId(wordId);
  }

  function selectCategory(categoryId: string) {
    if (showingAnswer || !selectedWordId) return;
    playSoundEffect("bonus-select");
    setAssignments((current) => ({
      ...current,
      [selectedWordId]: categoryId,
    }));
    setSelectedWordId(null);
  }

  return (
    <div className="flex w-full flex-col gap-3" data-bonus-category-sort>
      <div className="relative -translate-y-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {question.categories.map((category) => {
          const categoryIndex = question.categories.findIndex((candidate) => candidate.id === category.id);
          const palette = CATEGORY_SORT_PALETTES[categoryIndex % CATEGORY_SORT_PALETTES.length];
          const assignedWords = question.words.filter((word) => assignments[word.id] === category.id);
          const returningWords = question.words.filter(
            (word) => exitingAssignments[word.id] === category.id && assignments[word.id] !== category.id,
          );
          const words = [...assignedWords, ...returningWords];
          const categoryCorrect = showingAnswer && words.length === 3 && words.every((word) => categoryByWord.get(word.id) === category.id);
          const categoryWrong = showingAnswer && words.some((word) => categoryByWord.get(word.id) !== category.id);
          const categoryLabel = category.nameKey ? t(`cards.groups.${category.nameKey}` as never) : category.name;
          return (
            <div
              key={category.id}
              role="button"
              tabIndex={showingAnswer ? -1 : 0}
              aria-disabled={showingAnswer}
              aria-label={categoryLabel}
              onClick={() => selectCategory(category.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectCategory(category.id);
                }
              }}
              className={cn(
                "min-h-20 overflow-hidden rounded-xl text-left text-white transition-[filter,transform] duration-[260ms] ease-[cubic-bezier(0.85,0,0.15,1)]",
                palette.background,
                !showingAnswer && "hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90",
                categoryCorrect && "ring-2 ring-emerald-100",
                categoryWrong && "ring-2 ring-rose-100",
              )}
              data-bonus-category={category.id}
            >
              <div className="px-2.5 py-2">
                <span className={cn(
                  "block text-sm font-semibold text-white",
                  canUseSuperWater(locale) && "font-super-water",
                )}>
                  {formatSuperWaterText(locale, categoryLabel)}
                </span>
              </div>
              <div className="min-h-8 bg-black/20 px-2.5 py-2">
                <span className="flex min-h-8 flex-wrap gap-1">
                  {words.map((word) => {
                    const isReturning = exitingAssignments[word.id] === category.id && assignments[word.id] !== category.id;
                    const placed = !isReturning && assignments[word.id] === category.id;
                    const correct = placed && (!showingAnswer || assignments[word.id] === categoryByWord.get(word.id));
                    const wrong = showingAnswer && assignments[word.id] !== categoryByWord.get(word.id);
                    const feedback: QuizWordButtonFeedback = correct
                      ? "correct"
                      : wrong
                        ? "incorrect"
                        : isReturning
                          ? "muted"
                          : "matched";
                    return (
                      <QuizWordButton
                        key={word.id}
                        type="button"
                        disabled={showingAnswer || isReturning}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectWord(word.id);
                        }}
                        wordType={showingAnswer || isReturning ? "inactive" : "select"}
                        feedback={feedback}
                        correctClassName={cn(palette.background, "border-transparent text-white")}
                        className={cn(
                          "px-1.5 py-1 text-xs text-white border-white/30",
                          palette.background,
                          isReturning ? "animate-bonus-category-word-exit" : "animate-bonus-category-word-enter",
                        )}
                        data-bonus-category-assigned-word={word.id}
                      >
                        {word.text}
                      </QuizWordButton>
                    );
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="relative translate-y-5 flex flex-wrap justify-center gap-2">
        {question.words.map((word) => {
          const assigned = assignments[word.id];
          const assignedCategoryIndex = assigned
            ? question.categories.findIndex((category) => category.id === assigned)
            : -1;
          const assignedPalette = assignedCategoryIndex >= 0
            ? CATEGORY_SORT_PALETTES[assignedCategoryIndex % CATEGORY_SORT_PALETTES.length]
            : null;
          const correct = showingAnswer && assigned === categoryByWord.get(word.id);
          const wrong = showingAnswer && assigned !== categoryByWord.get(word.id);
          const feedback: QuizWordButtonFeedback = correct
            ? "correct"
            : wrong
              ? "incorrect"
              : showingAnswer
                ? "muted"
                : selectedWordId === word.id
                  ? "selected"
                  : assigned
                    ? "matched"
                    : "idle";
          return (
            <QuizWordButton
              key={word.id}
              type="button"
              disabled={showingAnswer}
              onClick={() => selectWord(word.id)}
              wordType={showingAnswer ? "inactive" : "select"}
              selected={feedback === "selected"}
              feedback={feedback === "selected" ? undefined : feedback}
              className={cn(
                "min-h-14",
                feedback === "matched" && assignedPalette?.background,
                returningWordIds[word.id] && "animate-bonus-category-word-return",
              )}
              data-bonus-category-word={word.id}
              data-bonus-result={feedback === "matched" ? "idle" : feedback}
            >
              {word.text}
            </QuizWordButton>
          );
        })}
      </div>
      <BonusCheckButton
        disabled={!canCheck || showingAnswer}
        onClick={() => onSubmit("category-sort", isCorrect)}
        showingAnswer={showingAnswer}
        onSkip={onSkip}
      />
      <span className="sr-only" data-bonus-answer-state>{answerAccepted === null ? "idle" : answerAccepted ? "correct" : "incorrect"}</span>
    </div>
  );
}

function ImposterBonus({
  question,
  showingAnswer,
  answerAccepted,
  onSubmit,
  onSkip,
}: {
  question: ImposterBonusQuestion;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
  onSubmit: (answer: string, isCorrect: boolean) => void;
  onSkip: () => void;
}) {
  const { locale, t } = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const copy = getBonusCopy(locale);
  const groupLabel = t(`cards.groups.${question.groupId}` as never);

  function selectOption(optionId: string) {
    if (showingAnswer) return;
    playSoundEffect("bonus-select");
    setSelectedId(optionId);
    onSubmit("imposter", optionId === question.correctOptionId);
  }

  return (
    <div className="flex w-full flex-col items-center gap-4" data-bonus-imposter>
      <div className="flex items-center gap-1 px-4 py-3">
        <Image src={question.groupImageSrc} alt="" width={112} height={112} className="size-24 rounded-xl object-cover sm:size-28" />
        <span className={cn(
          "text-2xl font-semibold text-foreground sm:text-3xl",
          canUseSuperWater(locale) && "font-super-water",
        )}>
          {formatSuperWaterText(locale, groupLabel)}
        </span>
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5">
        {question.options.map((option) => {
          const correct = showingAnswer && option.id === question.correctOptionId;
          const wrong = showingAnswer && option.id === selectedId && !option.isImposter;
          const feedback: QuizWordButtonFeedback = correct
            ? "correct"
            : wrong
              ? "incorrect"
              : showingAnswer
                ? "muted"
                : selectedId === option.id
                  ? "selected"
                  : "idle";
          return (
            <QuizWordButton
              key={option.id}
              type="button"
              disabled={showingAnswer}
              onClick={() => selectOption(option.id)}
              wordType={showingAnswer ? "inactive" : "select"}
              selected={feedback === "selected"}
              feedback={feedback === "selected" ? undefined : feedback}
              className="h-[5.2rem] min-h-[5.2rem] w-full text-lg sm:text-xl"
              data-bonus-imposter-option={option.id}
              data-bonus-result={feedback}
            >
              {option.text}
            </QuizWordButton>
          );
        })}
      </div>
      <QuizMobileActionPortal withinTransition>
        <div className="mt-1 flex w-full justify-center" data-quiz-bottom-actions>
          <QuizSkipButton
            className="w-full max-w-sm"
            disabled={showingAnswer}
            onClick={onSkip}
          />
        </div>
      </QuizMobileActionPortal>
      <span className="sr-only" data-bonus-answer-state>{answerAccepted === null ? "idle" : answerAccepted ? "correct" : "incorrect"}</span>
      <span className="sr-only">{copy.imposterTitle}</span>
    </div>
  );
}

function BonusCheckButton({
  disabled,
  onClick,
  onSkip,
  showingAnswer,
}: {
  disabled: boolean;
  onClick: () => void;
  onSkip: () => void;
  showingAnswer: boolean;
}) {
  const { locale } = useLocale();
  const copy = getBonusCopy(locale);
  return (
    <QuizMobileActionPortal withinTransition>
      <div className="mt-1 flex w-full gap-2" data-quiz-bottom-actions>
        <QuizSkipButton
          className="min-w-0 flex-1"
          disabled={showingAnswer}
          onClick={onSkip}
        />
        <div
          className={cn(
            "quiz-action-depth quiz-action-depth--check min-w-0 flex-[1.45]",
            (disabled || showingAnswer) && "quiz-action-depth--locked",
          )}
          data-quiz-check-action
        >
          <Button
            type="button"
            disabled={disabled || showingAnswer}
            onClick={onClick}
            className="quiz-action-scale w-full bg-brand text-brand-foreground hover:bg-brand-hover disabled:opacity-100"
            data-bonus-check
          >
            {copy.check}
          </Button>
        </div>
      </div>
    </QuizMobileActionPortal>
  );
}

const MATCHING_CORRECT_ANIMATION_MS = 700;
const MATCHING_INVALID_ANIMATION_MS = 420;

function getBonusTitle(copy: ReturnType<typeof getBonusCopy>, kind: BonusQuestion["kind"]) {
  if (kind === "matching") return copy.matchingTitle;
  if (kind === "sentence-order") return copy.sentenceTitle;
  if (kind === "category-sort") return copy.categoryTitle;
  return copy.imposterTitle;
}
