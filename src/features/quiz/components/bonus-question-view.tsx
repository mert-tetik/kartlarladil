"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
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
import {
  getScoreFlightAwardAtArrival,
  getScoreFlightIconCount,
} from "@/features/progress/score-flight";
import { ScoreIcon } from "@/components/score-icon";
import { GemRewardFlight } from "@/features/progress/components/gem-reward-flight";
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

const SENTENCE_TOKEN_ANIMATION_MS = 360;
const CATEGORY_WORD_ANIMATION_MS = 260;
const BONUS_REWARD_IMAGE = "/quiz/bonus_img.png";
const BONUS_INTRO_FRAME_COUNT = 13;
const BONUS_INTRO_FRAME_DURATION_MS = 1_000 / 30;
const BONUS_INTRO_HOLD_DURATION_MS = 800;
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

    gl.uniform2f(resolutionLocation, width, height);
    gl.uniform4f(
      frameRectLocation,
      (atlasColumn * BONUS_INTRO_FRAME_WIDTH) / atlas.naturalWidth + insetX,
      (atlasRow * BONUS_INTRO_FRAME_HEIGHT) / atlas.naturalHeight + insetY,
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
  const spriteRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

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

          if (currentFrame <= 1) {
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
  }, []);

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
      >
        {formatSuperWaterText(locale, copy.intro)}
      </span>
    </div>,
    document.body,
  );
}

export function BonusQuestionView({
  question,
  showingAnswer,
  answerAccepted,
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
}: {
  question: BonusQuestion;
  showingAnswer: boolean;
  answerAccepted: boolean | null;
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
}) {
  const { locale, t } = useLocale();
  const copy = getBonusCopy(locale);
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const rewardFlightStartedRef = useRef(false);
  const [rewardPulse, setRewardPulse] = useState(0);
  const points = getBonusQuestionPoints(question.kind);
  const isSentenceOrder = question.kind === "sentence-order";
  const [sentenceDecorationCharacter] = useState(() => {
    const characters = getAiPracticeCharacters();
    return characters[Math.floor(Math.random() * characters.length)] ?? characters[0]!;
  });
  const showRewardHud = showingAnswer && answerAccepted === true;
  const rewardFlightReady = showingAnswer && answerAccepted && rewardReady && (showPointFlight || Boolean(gemRewards?.length));

  useEffect(() => {
    if (!rewardFlightReady || rewardFlightStartedRef.current) return;
    rewardFlightStartedRef.current = true;
    setRewardPulse((current) => current + 1);
  }, [rewardFlightReady]);

  return (
    <div
      className={cn(
        "animate-screen-pop relative flex w-full max-w-2xl flex-col items-center gap-4 rounded-xl bg-transparent px-1 py-2 text-foreground sm:gap-5 sm:px-4",
        isSentenceOrder && "isolate",
      )}
      data-bonus-question={question.kind}
    >
      {isSentenceOrder ? (
        <div
          className="pointer-events-none fixed bottom-0 left-1/2 z-0 h-[min(112vw,36rem)] w-[min(112vw,36rem)] -translate-x-1/2 translate-y-1/2 opacity-25"
          data-bonus-sentence-decoration
          aria-hidden="true"
        >
          <Image
            src={sentenceDecorationCharacter.imageSrc}
            alt=""
            fill
            sizes="(max-width: 640px) 112vw, 576px"
            className="object-contain"
          />
        </div>
      ) : null}

      {showRewardHud ? (
        <div className="relative z-10 flex flex-col items-center gap-2" data-bonus-reward-hud>
          <div
            className="animate-points-pop relative inline-flex items-center gap-1.5 rounded-full border border-[var(--score-start)]/30 bg-gradient-to-r from-[var(--score-start)] to-[var(--score-end)] px-3 py-1.5 text-white shadow-sm"
            data-bonus-reward-score
          >
            <ScoreIcon size={22} className="size-[22px]" />
            <span
              className={cn(
                "text-base font-bold",
                canUseSuperWater(locale) && "font-super-water",
                scorePulse > 0 && "animate-score-bobble",
              )}
              key={scorePulse}
            >
              {formatSuperWaterText(locale, formatNumber(locale, totalPoints))}
            </span>
          </div>
          <RewardGemHud
            animate
            size="large"
            balances={gemBalances}
            pulse={gemPulse}
            superWater={canUseSuperWater(locale)}
          />
        </div>
      ) : null}

      <div className="relative z-10 flex flex-col items-center gap-1 text-center">
        <div
          ref={sourceRef}
          key={rewardPulse}
          className={cn(
            "relative w-[min(10rem,40vw)]",
            rewardPulse > 0 && "animate-bonus-reward-pulse",
          )}
          data-bonus-reward-source
          aria-hidden="true"
        >
          <Image
            src={BONUS_REWARD_IMAGE}
            alt=""
            width={1536}
            height={1000}
            sizes="(max-width: 640px) 40vw, 160px"
            className="h-auto w-full object-contain"
          />
        </div>
        <h2
          className={cn(
            "text-2xl font-semibold text-white sm:text-3xl",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {formatSuperWaterText(
            locale,
            question.kind === "matching"
              ? MATCHING_BONUS_TITLES[locale]
              : getBonusTitle(copy, question.kind),
          )}
        </h2>
        {question.kind !== "matching" ? (
          <p className="text-sm font-medium text-white">
            {getBonusPrompt(copy, question.kind)}
          </p>
        ) : null}
      </div>

      <div className="relative z-10 flex w-full flex-col items-center">
        {question.kind === "matching" ? (
          <MatchingBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        ) : question.kind === "sentence-order" ? (
          <SentenceOrderBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        ) : question.kind === "category-sort" ? (
          <CategorySortBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        ) : (
          <ImposterBonus question={question} showingAnswer={showingAnswer} answerAccepted={answerAccepted} onSubmit={onSubmit} onSkip={onSkip} />
        )}
      </div>

      <div className="relative z-10 flex w-full flex-col items-center gap-2">
        {!showingAnswer ? null : (
          <div className={cn("flex items-center gap-2 text-sm font-semibold", answerAccepted ? "text-emerald-500" : "text-rose-500")}>
            {answerAccepted ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <XCircle className="size-5" aria-hidden="true" />}
            {answerAccepted ? copy.correct : copy.incorrect}
          </div>
        )}
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

      {showingAnswer && answerAccepted && rewardReady && showPointFlight
        ? <BonusPointFlight
            points={points}
            sourceRef={sourceRef}
            onFlightStart={onFlightStart}
            onPointArrive={onPointArrive}
            onComplete={onFlightComplete}
          />
        : null}

      {showingAnswer && answerAccepted && rewardReady && gemRewards?.length
        ? <GemRewardFlight
            rewards={gemRewards}
            sourceRef={sourceRef}
            onGemArrive={onGemArrive}
            onComplete={onGemFlightComplete}
          />
        : null}
    </div>
  );
}

function MatchingBonus({
  question,
  showingAnswer,
  answerAccepted,
  onSubmit,
  onSkip,
}: {
  question: MatchingBonusQuestion;
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
  const boardRef = useRef<HTMLDivElement | null>(null);
  const termRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const meaningRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [connections, setConnections] = useState<Array<{ id: string; x1: number; y1: number; x2: number; y2: number; color: string }>>([]);
  const matchedMeaningIds = new Set(Object.values(matches));
  const canCheck = Object.keys(matches).length === question.pairs.length;
  const isCorrect = question.pairs.every((pair) => matches[pair.id] === pair.id);

  function selectTerm(id: string) {
    if (showingAnswer) return;

    if (!selectedMeaningId) {
      setSelectedTermId(id);
      return;
    }

    setMatches((current) => {
      const next = { ...current };
      Object.entries(next).forEach(([termId, meaningId]) => {
        if (termId === id || meaningId === selectedMeaningId) delete next[termId];
      });
      next[id] = selectedMeaningId;
      return next;
    });
    setSelectedTermId(null);
    setSelectedMeaningId(null);
  }

  function selectMeaning(id: string) {
    if (showingAnswer) return;

    if (!selectedTermId) {
      setSelectedMeaningId(id);
      return;
    }

    setMatches((current) => {
      const next = { ...current };
      Object.entries(next).forEach(([termId, meaningId]) => {
        if (termId === selectedTermId || meaningId === id) delete next[termId];
      });
      next[selectedTermId] = id;
      return next;
    });
    setSelectedTermId(null);
    setSelectedMeaningId(null);
  }

  useEffect(() => {
    function updateConnections() {
      const board = boardRef.current;
      if (!board) return;

      const boardRect = board.getBoundingClientRect();
      const nextConnections = Object.entries(matches).flatMap(([termId, meaningId]) => {
        const term = termRefs.current[termId];
        const meaning = meaningRefs.current[meaningId];
        if (!term || !meaning) return [];

        const termRect = term.getBoundingClientRect();
        const meaningRect = meaning.getBoundingClientRect();
         const colorIndex = question.pairs.findIndex((pair) => pair.id === termId);
         const color = showingAnswer
           ? (matches[termId] === termId ? "#22c55e" : "#ef4444")
           : MATCHING_PAIR_COLORS[Math.max(0, colorIndex) % MATCHING_PAIR_COLORS.length]?.background ?? MATCHING_PAIR_COLORS[0].background;

        return [{
          id: `${termId}-${meaningId}`,
          x1: termRect.right - boardRect.left - termRect.width * MATCHING_CONNECTOR_INSET_RATIO,
          y1: termRect.top + termRect.height / 2 - boardRect.top,
          x2: meaningRect.left - boardRect.left + meaningRect.width * MATCHING_CONNECTOR_INSET_RATIO,
          y2: meaningRect.top + meaningRect.height / 2 - boardRect.top,
          color,
        }];
      });

      setConnections(nextConnections);
    }

    updateConnections();
    window.addEventListener("resize", updateConnections);
    const resizeObserver = typeof ResizeObserver === "undefined" || !boardRef.current
      ? null
      : new ResizeObserver(updateConnections);
    if (resizeObserver && boardRef.current) resizeObserver.observe(boardRef.current);

    return () => {
      window.removeEventListener("resize", updateConnections);
      resizeObserver?.disconnect();
    };
  }, [matches, question.pairs, showingAnswer]);

  return (
    <div ref={boardRef} className="relative grid w-full grid-cols-2 gap-3 sm:gap-4" data-bonus-matching-board>
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true" data-bonus-matching-connections>
        {connections.map((connection) => (
          <line
            key={connection.id}
            x1={connection.x1}
            y1={connection.y1}
            x2={connection.x2}
            y2={connection.y2}
            stroke={connection.color}
            strokeWidth="5"
            strokeLinecap="round"
            className="transition-[stroke] duration-300 ease-[cubic-bezier(0.85,0,0.15,1)]"
            data-bonus-matching-connection={connection.id}
          />
        ))}
      </svg>

      <div className="relative z-10 flex min-w-0 flex-col items-center gap-2">
        <h3 className={cn("h-6 w-full text-center text-sm font-bold leading-6 text-white", usesSuperWater && "font-super-water")}>
          {formatSuperWaterUppercaseText(locale, columnCopy.terms)}
        </h3>
        <div className="flex w-full flex-col items-center gap-3">
         {question.terms.map((pair) => {
           const matched = Boolean(matches[pair.id]);
           const correct = showingAnswer && matches[pair.id] === pair.id;
           const wrong = showingAnswer && matched && matches[pair.id] !== pair.id;
          const colorIndex = question.pairs.findIndex((candidate) => candidate.id === pair.id);
          const pairColor = MATCHING_PAIR_COLORS[Math.max(0, colorIndex) % MATCHING_PAIR_COLORS.length] ?? MATCHING_PAIR_COLORS[0];
          return (
            <button
              key={`term-${pair.id}`}
              type="button"
              disabled={showingAnswer}
              onClick={() => selectTerm(pair.id)}
              style={matched && !showingAnswer ? { backgroundColor: pairColor.background, borderColor: pairColor.background, color: pairColor.foreground } : undefined}
              ref={(element) => { termRefs.current[pair.id] = element; }}
              className={cn("w-[calc(100%-0.5rem)] min-h-14 rounded-lg border px-3 py-2 text-sm font-semibold transition-[transform,background-color,border-color,opacity] duration-300 ease-[cubic-bezier(0.85,0,0.15,1)]", (selectedTermId || selectedMeaningId) && "cursor-pointer", selectedTermId === pair.id && "-translate-y-0.5 ring-2 ring-brand", matched && !showingAnswer && "shadow-sm", correct && "border-emerald-500 bg-emerald-500 text-white", wrong && "border-rose-500 bg-rose-500 text-white", !matched && !showingAnswer && "bg-background-card hover:-translate-y-0.5 hover:border-brand", showingAnswer && !matched && "opacity-60")}
              data-bonus-term={pair.id}
              data-bonus-result={correct ? "correct" : wrong ? "incorrect" : "idle"}
            >
              {pair.term}
            </button>
          );
        })}
        </div>
      </div>
      <div className="relative z-10 flex min-w-0 flex-col items-center gap-2">
        <h3 className={cn("h-6 w-full text-center text-sm font-bold leading-6 text-white", usesSuperWater && "font-super-water")}>
          {formatSuperWaterUppercaseText(locale, columnCopy.meanings)}
        </h3>
        <div className="flex w-full flex-col items-center gap-3">
        {question.meanings.map((pair) => {
          const pairedTermId = Object.entries(matches).find(([, meaningId]) => meaningId === pair.id)?.[0];
          const correct = showingAnswer && pairedTermId === pair.id;
          const wrong = showingAnswer && pairedTermId !== undefined && pairedTermId !== pair.id;
          const colorIndex = pairedTermId ? question.pairs.findIndex((candidate) => candidate.id === pairedTermId) : -1;
          const pairColor = MATCHING_PAIR_COLORS[Math.max(0, colorIndex) % MATCHING_PAIR_COLORS.length] ?? MATCHING_PAIR_COLORS[0];
          const selected = selectedMeaningId === pair.id;
          return (
            <button
              key={`meaning-${pair.id}`}
              type="button"
              disabled={showingAnswer}
              onClick={() => selectMeaning(pair.id)}
              style={pairedTermId && !showingAnswer ? { backgroundColor: pairColor.background, borderColor: pairColor.background, color: pairColor.foreground } : undefined}
              ref={(element) => { meaningRefs.current[pair.id] = element; }}
              className={cn("w-[calc(100%-0.5rem)] min-h-14 rounded-lg border px-3 py-2 text-sm font-semibold transition-[transform,background-color,border-color,opacity] duration-300 ease-[cubic-bezier(0.85,0,0.15,1)]", selected && "-translate-y-0.5 ring-2 ring-brand", pairedTermId && !showingAnswer && "shadow-sm", correct && "border-emerald-500 bg-emerald-500 text-white", wrong && "border-rose-500 bg-rose-500 text-white", !pairedTermId && !showingAnswer && "bg-background-card hover:-translate-y-0.5 hover:border-brand", showingAnswer && !pairedTermId && "opacity-60")}
              data-bonus-meaning={pair.id}
              data-bonus-result={correct ? "correct" : wrong ? "incorrect" : "idle"}
            >
              {pair.meaning}
            </button>
          );
        })}
        </div>
      </div>
      <div className="relative z-10 col-span-2">
        <BonusCheckButton
          disabled={!canCheck || showingAnswer}
          onClick={() => onSubmit("matching", isCorrect)}
          showingAnswer={showingAnswer}
          onSkip={onSkip}
        />
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
  const isCorrect = selectedIds.every((id, index) => id === question.tokens[index]?.id);

  useEffect(() => () => {
    if (returnAnimationTimerRef.current !== null) {
      window.clearTimeout(returnAnimationTimerRef.current);
    }
  }, []);

  function toggleToken(id: string) {
    if (showingAnswer) return;

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
      <div className="min-h-20 rounded-xl border border-border bg-background-card p-3 text-left" data-bonus-sentence-display>
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedIds.map((id, index) => {
              const token = question.tokens.find((candidate) => candidate.id === id)!;
              const correct = showingAnswer && id === question.tokens[index]?.id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={showingAnswer}
                  onClick={() => toggleToken(id)}
                  className={cn(
                    "rounded-md border-0 px-2.5 py-1.5 text-sm font-semibold transition-[transform,opacity,background-color] duration-[360ms] ease-[cubic-bezier(0.85,0,0.15,1)]",
                    "animate-bonus-sentence-token-enter",
                    correct ? "bg-emerald-500 text-white" : showingAnswer ? "bg-rose-500 text-white" : "bg-brand text-brand-foreground",
                  )}
                  data-bonus-sentence-selected={id}
                >
                  {token.text}
                </button>
              );
            })}
          </div>
        ) : <span className="text-sm text-foreground-muted">…</span>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {displayTokens.map((token) => (
          <button
            key={token.id}
            type="button"
            disabled={showingAnswer}
            onClick={() => toggleToken(token.id)}
            className={cn(
              "rounded-md border border-border bg-background-card px-3 py-2 text-sm font-semibold transition-[transform,opacity,background-color] duration-[360ms] ease-[cubic-bezier(0.85,0,0.15,1)] hover:-translate-y-0.5",
              selectedSet.has(token.id) && "opacity-35",
              returningTokenId === token.id && "animate-bonus-sentence-token-return",
              showingAnswer && "opacity-60",
            )}
            data-bonus-sentence-token={token.id}
          >
            {token.text}
          </button>
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
    setAssignments((current) => ({
      ...current,
      [selectedWordId]: categoryId,
    }));
    setSelectedWordId(null);
  }

  return (
    <div className="flex w-full flex-col gap-3" data-bonus-category-sort>
      <div className="flex flex-wrap justify-center gap-2">
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
          return (
            <button
              key={word.id}
              type="button"
              disabled={showingAnswer}
              onClick={() => selectWord(word.id)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-semibold transition-[transform,opacity,background-color] duration-[260ms] ease-[cubic-bezier(0.85,0,0.15,1)]",
                selectedWordId === word.id && "-translate-y-0.5 ring-2 ring-brand",
                assignedPalette?.background,
                assigned && "border-0 text-white",
                returningWordIds[word.id] && "animate-bonus-category-word-return",
                correct && "bg-emerald-500 text-white border-emerald-500",
                wrong && "bg-rose-500 text-white border-rose-500",
                !assigned && !showingAnswer && "bg-background-card hover:-translate-y-0.5 hover:border-brand",
                showingAnswer && !assigned && "opacity-60",
              )}
              data-bonus-category-word={word.id}
              data-bonus-result={correct ? "correct" : wrong ? "incorrect" : "idle"}
            >
              {word.text}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                    const correct = showingAnswer && assignments[word.id] === categoryByWord.get(word.id);
                    const wrong = showingAnswer && assignments[word.id] !== categoryByWord.get(word.id);
                    return (
                      <button
                        key={word.id}
                        type="button"
                        disabled={showingAnswer || isReturning}
                        onClick={(event) => {
                          event.stopPropagation();
                          selectWord(word.id);
                        }}
                        className={cn(
                          "rounded-md border-0 px-1.5 py-1 text-xs font-semibold text-white transition-[transform,opacity,background-color] duration-[260ms] ease-[cubic-bezier(0.85,0,0.15,1)]",
                          palette.background,
                          isReturning ? "animate-bonus-category-word-exit" : "animate-bonus-category-word-enter",
                          correct && "bg-emerald-600",
                          wrong && "bg-rose-600",
                        )}
                        data-bonus-category-assigned-word={word.id}
                      >
                        {word.text}
                      </button>
                    );
                  })}
                </span>
              </div>
            </div>
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
  const isCorrect = selectedId === question.correctOptionId;

  return (
    <div className="flex w-full flex-col items-center gap-4" data-bonus-imposter>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background-card px-4 py-3">
        <Image src={question.groupImageSrc} alt="" width={56} height={56} className="size-14 rounded-lg object-cover" />
        <span className="text-base font-semibold text-foreground">{groupLabel}</span>
      </div>
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5">
        {question.options.map((option) => {
          const correct = showingAnswer && option.id === question.correctOptionId;
          const wrong = showingAnswer && option.id === selectedId && !option.isImposter;
          return (
            <button
              key={option.id}
              type="button"
              disabled={showingAnswer}
              onClick={() => setSelectedId(option.id)}
              className={cn("min-h-16 rounded-lg border border-border bg-background-card px-2 py-2 text-sm font-semibold transition-[transform,background-color,border-color,opacity] duration-300 hover:-translate-y-0.5 hover:border-brand", selectedId === option.id && "border-brand bg-brand/15 ring-2 ring-brand", correct && "border-emerald-500 bg-emerald-500 text-white", wrong && "border-rose-500 bg-rose-500 text-white", showingAnswer && option.id !== selectedId && !correct && "opacity-60")}
              data-bonus-imposter-option={option.id}
              data-bonus-result={correct ? "correct" : wrong ? "incorrect" : "idle"}
            >
              {option.text}
            </button>
          );
        })}
      </div>
      <BonusCheckButton
        disabled={!selectedId || showingAnswer}
        onClick={() => onSubmit("imposter", isCorrect)}
        showingAnswer={showingAnswer}
        onSkip={onSkip}
      />
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
    <div className={cn("mt-1 flex w-full gap-2", showingAnswer && "pointer-events-none")}>
      <QuizSkipButton
        className="min-w-0 flex-1"
        disabled={showingAnswer}
        hidden={showingAnswer}
        onClick={onSkip}
      />
      <div
        className={cn(
          "quiz-action-depth quiz-action-depth--check min-w-0 flex-[1.45]",
          disabled && "quiz-action-depth--locked",
        )}
        data-quiz-action-hidden={showingAnswer}
      >
        <Button
          type="button"
          disabled={disabled || showingAnswer}
          onClick={onClick}
          className="quiz-action-scale w-full bg-brand text-brand-foreground hover:bg-brand-hover disabled:opacity-100"
          data-quiz-action-hidden={showingAnswer}
          data-bonus-check
        >
          {copy.check}
        </Button>
      </div>
    </div>
  );
}

function BonusPointFlight({
  points,
  sourceRef,
  onFlightStart,
  onPointArrive,
  onComplete,
}: {
  points: number;
  sourceRef: RefObject<HTMLDivElement | null>;
  onFlightStart?: () => void;
  onPointArrive?: (points: number) => void;
  onComplete?: () => void;
}) {
  const [icons, setIcons] = useState<FlightIcon[]>([]);
  const startedRef = useRef(false);
  const completedRef = useRef(false);
  const arrivedRef = useRef(new Set<number>());
  const onFlightStartRef = useRef(onFlightStart);
  const onPointArriveRef = useRef(onPointArrive);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onFlightStartRef.current = onFlightStart;
    onPointArriveRef.current = onPointArrive;
    onCompleteRef.current = onComplete;
  }, [onComplete, onFlightStart, onPointArrive]);

  useEffect(() => {
    const activeTimers: number[] = [];
    if (startedRef.current) return;
    startedRef.current = true;
    onFlightStartRef.current?.();

    const frame = window.requestAnimationFrame(() => {
      const source = sourceRef.current?.getBoundingClientRect();
      const target = document
        .querySelector<HTMLElement>("[data-bonus-reward-score], [data-quiz-total-score]")
        ?.getBoundingClientRect();
      if (!source || !target || source.width === 0 || source.height === 0 || target.width === 0 || target.height === 0) {
        completedRef.current = true;
        onCompleteRef.current?.();
        return;
      }

      const targetX = target.left + target.width / 2;
      const targetY = target.top + target.height / 2;
      const iconCount = getScoreFlightIconCount(points);
      const nextIcons = Array.from({ length: iconCount }, (_, index) => {
        const ratio = iconCount === 1 ? 0 : index / (iconCount - 1);
        return {
          id: index,
          startX: source.left + source.width * (0.28 + Math.random() * 0.44),
          startY: source.top + source.height * (0.35 + Math.random() * 0.3),
          scatterX: (Math.random() - 0.5) * 100,
          scatterY: -25 - Math.random() * 70,
          targetX,
          targetY,
          delay: Math.round(ratio * 520),
        };
      });
      setIcons(nextIcons);
      const finishTimer = window.setTimeout(() => finishFlight(nextIcons.length), 2_300);
      activeTimers.push(finishTimer);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      activeTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [points, sourceRef]);

  function finishFlight(iconCount: number) {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current?.();
    setIcons([]);
    if (iconCount === 0) return;
  }

  function handleIconEnd(iconId: number) {
    if (arrivedRef.current.has(iconId)) return;
    arrivedRef.current.add(iconId);
    const arrivalIndex = arrivedRef.current.size;
    onPointArriveRef.current?.(getScoreFlightAwardAtArrival(points, icons.length, arrivalIndex));
    playSoundEffect("points");
    vibrate("tap");

    if (arrivalIndex === icons.length) {
      finishFlight(icons.length);
    }
  }

  if (icons.length === 0) return null;

  return createPortal(
    <>
      {icons.map((icon) => (
        <span
          key={icon.id}
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-[80] animate-quiz-score-icon-flight"
          onAnimationEnd={() => handleIconEnd(icon.id)}
          style={{
            "--score-flight-start-x": `${icon.startX}px`,
            "--score-flight-start-y": `${icon.startY}px`,
            "--score-flight-scatter-x": `${icon.startX + icon.scatterX}px`,
            "--score-flight-scatter-y": `${icon.startY + icon.scatterY}px`,
            "--score-flight-target-x": `${icon.targetX}px`,
            "--score-flight-target-y": `${icon.targetY}px`,
            animationDelay: `${icon.delay}ms`,
          } as CSSProperties}
        >
          <ScoreIcon size={30} />
        </span>
      ))}
    </>,
    document.body,
  );
}

type FlightIcon = {
  id: number;
  startX: number;
  startY: number;
  scatterX: number;
  scatterY: number;
  targetX: number;
  targetY: number;
  delay: number;
};

const MATCHING_PAIR_COLORS = [
  { background: "#22c55e", foreground: "#ffffff" },
  { background: "#3b82f6", foreground: "#ffffff" },
  { background: "#ef4444", foreground: "#ffffff" },
  { background: "#eab308", foreground: "#111827" },
] as const;

const MATCHING_CONNECTOR_INSET_RATIO = 0.18;

function getBonusTitle(copy: ReturnType<typeof getBonusCopy>, kind: BonusQuestion["kind"]) {
  if (kind === "matching") return copy.matchingTitle;
  if (kind === "sentence-order") return copy.sentenceTitle;
  if (kind === "category-sort") return copy.categoryTitle;
  return copy.imposterTitle;
}

function getBonusPrompt(copy: ReturnType<typeof getBonusCopy>, kind: BonusQuestion["kind"]) {
  if (kind === "matching") return copy.matchingPrompt;
  if (kind === "sentence-order") return copy.sentencePrompt;
  if (kind === "category-sort") return copy.categoryPrompt;
  return copy.imposterPrompt;
}
