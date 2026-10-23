"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Volume2 } from "lucide-react";
import { getLocaleDirection } from "@/data/languages";
import { fitCardExampleText } from "@/features/cards/card-example-fitting";
import { FittedSingleLineText } from "@/features/cards/components/fitted-single-line-text";
import { CARD_SPEECH_STATUS_EVENT, speakCardTerm, type CardSpeechStatusDetail } from "@/features/cards/card-speech";
import { getCardDesignTierPalette, type CardDesignTierPalette } from "@/features/cards/card-design-tier-palette";
import type { CardDesignTestSample } from "@/features/cards/card-design-test-sample";
import { playSoundEffect } from "@/lib/sound-effects";

export interface VocabularyCardDesignProps {
  sample: CardDesignTestSample;
  showBack?: boolean;
  className?: string;
  contentScale?: number;
  onSpeak?: () => void;
  backDisplayTier?: CardDesignTestSample["tier"];
  continuousFlip?: boolean;
  learningProgress?: {
    current: number;
    required: number;
    progressLabel: string;
    isLearned?: boolean;
    animationActive?: boolean;
    animationKey?: number;
  };
}

const FOX_OUTLINE = "M10 22 13 5l18 12a24 24 0 0 1 14 0L63 5l3 17c1 14-7 26-20 31-5 2-11 2-16 0C17 48 9 36 10 22Z";
const FOX_FACE = "M27 34h.1M49 34h.1M35 40q3 3 6 0";
const CARD_SHELL_PATH = "M55 4C28 4 8 23 8 52v466c0 27 18 43 45 43h294c27 0 45-16 45-43V52c0-29-20-48-47-48H55Z";
const CARD_BACK_PANEL_PATH = "M58 30C40 30 27 45 27 65v439c0 21 14 35 36 35h274c22 0 36-14 36-35V65c0-20-14-35-36-35H58Z";
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function GlassShellGradient({ id, palette }: { id: string; palette: CardDesignTierPalette }) {
  return (
    <linearGradient id={id} x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stopColor="#f8ffff" />
      <stop offset="0.14" stopColor={palette.shellPrimary} />
      <stop offset="0.46" stopColor={palette.shellHighlight} />
      <stop offset="0.74" stopColor={palette.shellEnd} />
      <stop offset="0.9" stopColor={palette.shellHighlight} />
      <stop offset="1" stopColor={palette.shellEnd} />
    </linearGradient>
  );
}

function CarvedFoxMark({
  className,
  filled = false,
  testId,
}: {
  className: string;
  filled?: boolean;
  testId: string;
}) {
  return (
    <svg aria-label="FoxiesDeck fox mark" className={className} data-testid={testId} fill="none" role="img" viewBox="0 0 76 58">
      {filled ? (
        <g opacity="0.14">
          <path d={FOX_OUTLINE} fill="#ffffff" />
          <path d={FOX_FACE} fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="2.7" />
        </g>
      ) : (
        <>
          <path d={FOX_OUTLINE} stroke="#b29a70" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" transform="translate(0 -1)" />
          <path d={FOX_OUTLINE} stroke="#fff7e4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" transform="translate(0 1)" />
          <path d={FOX_FACE} stroke="#a88f65" strokeLinecap="round" strokeWidth="2.7" transform="translate(0 -0.8)" />
          <path d={FOX_FACE} stroke="#fff8e9" strokeLinecap="round" strokeWidth="1.3" transform="translate(0 0.8)" />
        </>
      )}
    </svg>
  );
}

/**
 * The single vocabulary-card face renderer used by the app, generated posts,
 * visual tests, and the bundled offline shell.
 */
export function VocabularyCardDesign({
  sample,
  showBack = false,
  className,
  contentScale = 1,
  onSpeak,
  backDisplayTier,
  continuousFlip = false,
  learningProgress,
}: VocabularyCardDesignProps) {
  const rawId = useId();
  const id = `fd-card-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const palette = getCardDesignTierPalette(sample.tier);
  const backTier = backDisplayTier ?? sample.tier;
  const backPalette = getCardDesignTierPalette(backTier);
  const scaleStyle = { "--fd-card-content-scale": contentScale } as CSSProperties;
  const progressRequired = Math.max(1, Math.floor(learningProgress?.required ?? 1));
  const progressCurrent = learningProgress?.isLearned
    ? progressRequired
    : Math.min(progressRequired, Math.max(0, Math.floor(learningProgress?.current ?? 0)));
  const progressLabel = learningProgress?.progressLabel;
  const progressFilledColor = `color-mix(in srgb, ${palette.label} 82%, #000)`;
  const progressEmptyColor = `color-mix(in srgb, ${palette.label} 34%, #fff)`;
  const [pronunciationSpeaking, setPronunciationSpeaking] = useState(false);
  const exampleRef = useRef<HTMLParagraphElement>(null);
  const lastProgressCompletionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!learningProgress?.animationActive || progressCurrent < progressRequired) {
      lastProgressCompletionKeyRef.current = null;
      return;
    }

    const completionKey = `${sample.cardId}:${learningProgress.animationKey ?? "complete"}`;
    if (lastProgressCompletionKeyRef.current === completionKey) return;

    lastProgressCompletionKeyRef.current = completionKey;
    playSoundEffect("card-progress-complete");
  }, [learningProgress?.animationActive, learningProgress?.animationKey, progressCurrent, progressRequired, sample.cardId]);

  useEffect(() => {
    const handleSpeechStatus = (event: Event) => {
      const detail = (event as CustomEvent<CardSpeechStatusDetail>).detail;
      if (!detail || typeof detail.text !== "string" || typeof detail.language !== "string") return;
      if (detail.text.trim() !== sample.term.trim() || detail.language !== sample.learningLanguage) return;
      setPronunciationSpeaking(detail.state === "start");
    };

    window.addEventListener(CARD_SPEECH_STATUS_EVENT, handleSpeechStatus);
    return () => window.removeEventListener(CARD_SPEECH_STATUS_EVENT, handleSpeechStatus);
  }, [sample.learningLanguage, sample.term]);

  useIsomorphicLayoutEffect(() => {
    const example = exampleRef.current;
    if (!example) return;

    let active = true;
    const fit = () => {
      if (active && example.isConnected) fitCardExampleText(example);
    };

    fit();

    const card = example.closest(".fd-card-design");
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    if (card && observer) observer.observe(card);

    const fontReady = document.fonts?.ready;
    if (fontReady) void fontReady.then(fit);
    if (!observer) window.addEventListener("resize", fit);

    return () => {
      active = false;
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", fit);
    };
  }, [sample.example]);

  return (
    <div
      className={`fd-card-design ${className ?? ""}`}
      data-card-face-state="true"
      data-card-face={showBack ? "back" : "front"}
      data-testid="card-face-state"
    >
      <div
        className={`fd-card-design__flipper${continuousFlip ? " animate-quiz-card-continuous-two-turn" : ""}`}
        style={continuousFlip ? undefined : { transform: showBack ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        <article
          aria-hidden={showBack}
          aria-label={`${sample.tier} vocabulary card`}
          className="fd-card-design__face fd-card-design__front"
          data-testid="reference-card"
          dir="auto"
          lang={sample.learningLanguage}
          inert={showBack}
        >
          <svg aria-hidden="true" className="fd-card-design__artwork" preserveAspectRatio="none" viewBox="0 0 400 570">
            <defs>
              <GlassShellGradient id={`${id}-front-shell`} palette={palette} />
              <linearGradient id={`${id}-aqua-inset`} x1="0" x2="0.9" y1="0" y2="1">
                <stop offset="0" stopColor={palette.insetPrimary} />
                <stop offset="0.58" stopColor={palette.insetMiddle} />
                <stop offset="1" stopColor={palette.insetEnd} />
              </linearGradient>
              <linearGradient id={`${id}-paper`} x1="0" x2="0.85" y1="0" y2="1">
                <stop offset="0" stopColor="#fff9e9" />
                <stop offset="0.54" stopColor="#fff4de" />
                <stop offset="1" stopColor="#fff0d3" />
              </linearGradient>
              <linearGradient id={`${id}-glass-shine`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="0.24" stopColor="#ffffff" stopOpacity="0.1" />
                <stop offset="0.78" stopColor="#ffffff" stopOpacity="0.12" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0.78" />
              </linearGradient>
              <filter height="120%" id={`${id}-front-shadow`} width="120%" x="-10%" y="-5%">
                <feDropShadow dx="0" dy="5" floodColor="#854c18" floodOpacity="0.27" stdDeviation="5" />
              </filter>
            </defs>
            <path d={CARD_SHELL_PATH} fill={`url(#${id}-front-shell)`} filter={`url(#${id}-front-shadow)`} />
            <path data-testid="card-front-glass-outline" d={CARD_SHELL_PATH} fill="none" stroke={palette.shellEnd} strokeOpacity="0.85" strokeWidth="3" />
            <path d="M56 11C32 11 15 28 15 53v464c0 22 15 36 39 36h292c24 0 39-14 39-36V53c0-25-17-42-41-42H56Z" fill={`url(#${id}-aqua-inset)`} stroke="#f7ffff" strokeOpacity="0.9" strokeWidth="4" />
            <path d="M39 55c43-12 82-6 125-5 58 2 112-10 162-5 18 2 31 6 39 12l-1 405c0 17-12 25-29 25-45 11-91 20-136 20-56 0-101-10-147-22-16-4-24-12-24-28V75c0-9 3-16 11-20Z" fill={`url(#${id}-paper)`} />
            <path d="M39 55c43-12 82-6 125-5 58 2 112-10 162-5 18 2 31 6 39 12" fill="none" stroke="#fffdf2" strokeOpacity="0.85" strokeWidth="3" />
            <path d="M43 67c-3 45-2 117-2 185 0 83 1 157 4 207M357 67c3 54 2 119 2 184 0 85-1 154-5 207" fill="none" stroke={`url(#${id}-glass-shine)`} strokeLinecap="round" strokeWidth="3" />
            <path d="M43 488c53 15 103 24 157 24s106-9 158-23" fill="none" stroke="#e9ffff" strokeOpacity="0.75" strokeWidth="2" />
          </svg>

          <div
            aria-label={sample.tier}
            className="fd-card-design__tier-badge font-super-water"
            data-testid="card-tier-badge"
            role="img"
            style={{ backgroundColor: palette.badge }}
          >
            {sample.tier}
          </div>

          <div className="fd-card-design__copy-scale" style={scaleStyle}>
            <h3 className="fd-card-design__term" data-testid="card-term" dir="auto" lang={sample.learningLanguage}>
              <FittedSingleLineText centered>{sample.term}</FittedSingleLineText>
            </h3>
            <div className="fd-card-design__translation" data-testid="card-translation" dir="auto" lang={sample.nativeLanguage}>
              <FittedSingleLineText centered>{sample.translation}</FittedSingleLineText>
            </div>
            <div
              className={`fd-card-design__pronunciation${pronunciationSpeaking ? " fd-card-design__pronunciation--speaking" : ""}`}
              data-pronunciation-speaking={pronunciationSpeaking ? "true" : "false"}
              data-testid="card-pronunciation"
              style={{ backgroundColor: palette.label }}
            >
              <button
                aria-label={`Listen to ${sample.term}`}
                className="fd-card-design__speak"
                data-card-speak="true"
                onClick={(event) => {
                  event.stopPropagation();
                  (onSpeak ?? (() => speakCardTerm(sample.term, sample.learningLanguage)))();
                }}
                title={`Listen to ${sample.term}`}
                type="button"
              >
                <Volume2 aria-hidden="true" className="fd-card-design__speaker-icon" />
              </button>
              <FittedSingleLineText className="fd-card-design__pronunciation-text">{sample.pronunciation || sample.term}</FittedSingleLineText>
            </div>
          </div>
          {learningProgress && progressLabel ? (
            <div
              aria-label={progressLabel}
              aria-valuemax={progressRequired}
              aria-valuemin={0}
              aria-valuenow={progressCurrent}
              aria-valuetext={`${progressCurrent}/${progressRequired}`}
              className="fd-card-design__progress fd-card-design__progress-circle"
              data-card-progress
              data-progress-animation-active={learningProgress.animationActive ? "true" : undefined}
              data-progress-animation-key={learningProgress.animationKey}
              data-progress-complete={progressCurrent >= progressRequired && learningProgress.animationActive ? "true" : undefined}
              role="progressbar"
              style={{
                "--fd-card-progress-filled-color": progressFilledColor,
                backgroundColor: progressEmptyColor,
              } as CSSProperties}
            >
              <span
                aria-hidden="true"
                className={`fd-card-design__progress-indicator${learningProgress.animationActive ? " fd-card-design__progress-indicator--animating" : ""}`}
                data-progress-indicator
                style={{
                  "--fd-card-progress-angle": `${(progressCurrent / progressRequired) * 360}deg`,
                  "--fd-card-progress-slice-angle": `${360 / progressRequired}deg`,
                  background: `conic-gradient(from -90deg, ${progressFilledColor} 0deg var(--fd-card-progress-angle), transparent var(--fd-card-progress-angle) 360deg)`,
                } as CSSProperties}
              >
                <span
                  aria-hidden="true"
                  className="fd-card-design__progress-slice-dividers"
                  data-progress-slice-dividers
                />
                <span
                  aria-hidden="true"
                  className="fd-card-design__progress-indicator-overlay"
                  data-progress-indicator-overlay
                  key={learningProgress.animationKey}
                  style={{
                    "--fd-card-progress-animation-start": palette.progressAnimation.start,
                    "--fd-card-progress-animation-middle": palette.progressAnimation.middle,
                    "--fd-card-progress-animation-end": palette.progressAnimation.end,
                    background: `conic-gradient(from -90deg, ${palette.progressAnimation.start} 0deg, ${palette.progressAnimation.middle} calc(var(--fd-card-progress-angle) * 0.55), ${palette.progressAnimation.end} var(--fd-card-progress-angle), transparent var(--fd-card-progress-angle) 360deg)`,
                  } as CSSProperties}
                />
              </span>
              <span
                aria-hidden="true"
                className="fd-card-design__progress-count"
                style={{ display: "inline-grid", placeItems: "center" }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    color: "#000",
                    transform: "translate(-2px, 2px)",
                  }}
                >
                  {progressCurrent}/{progressRequired}
                </span>
                <span style={{ position: "relative", zIndex: 1 }}>
                  {progressCurrent}/{progressRequired}
                </span>
              </span>
            </div>
          ) : null}
          <div className="fd-card-design__divider" />
          <CarvedFoxMark className="fd-card-design__front-fox" testId="fox-carved-mark" />
          <p className="fd-card-design__example" data-testid="card-reference-example" dir="auto" lang={sample.learningLanguage} ref={exampleRef}>
            {sample.example}
          </p>
        </article>

        <article
          aria-hidden={!showBack}
          aria-label={`${sample.tier} vocabulary card back`}
          className="fd-card-design__face fd-card-design__back"
          data-testid="reference-card-back"
          data-card-back-tier={backTier}
          lang={sample.nativeLanguage}
          dir={getLocaleDirection(sample.nativeLanguage)}
          inert={!showBack}
        >
          <svg aria-hidden="true" className="fd-card-design__artwork" data-testid="card-back-artwork" preserveAspectRatio="none" viewBox="0 0 400 570">
            <defs>
              <GlassShellGradient id={`${id}-back-shell`} palette={backPalette} />
              <linearGradient id={`${id}-back-panel`} x1="0" x2="0.88" y1="0" y2="1">
                <stop offset="0" stopColor={backPalette.insetPrimary} />
                <stop offset="0.52" stopColor={backPalette.insetMiddle} />
                <stop offset="1" stopColor={backPalette.shellEnd} />
              </linearGradient>
              <linearGradient id={`${id}-back-wave`} x1="0" x2="1" y1="0" y2="0.75">
                <stop offset="0" stopColor={backPalette.insetEnd} />
                <stop offset="0.54" stopColor={backPalette.shellHighlight} />
                <stop offset="1" stopColor={backPalette.insetPrimary} />
              </linearGradient>
              <clipPath id={`${id}-back-panel-clip`}>
                <path d={CARD_BACK_PANEL_PATH} />
              </clipPath>
              <filter height="120%" id={`${id}-back-shadow`} width="120%" x="-10%" y="-5%">
                <feDropShadow dx="0" dy="5" floodColor="#854c18" floodOpacity="0.27" stdDeviation="5" />
              </filter>
            </defs>
            <path d={CARD_SHELL_PATH} fill={`url(#${id}-back-shell)`} filter={`url(#${id}-back-shadow)`} />
            <path data-testid="card-back-glass-outline" d={CARD_SHELL_PATH} fill="none" stroke={backPalette.shellEnd} strokeOpacity="0.85" strokeWidth="3" />
            <g clipPath={`url(#${id}-back-panel-clip)`}>
              <path d={CARD_BACK_PANEL_PATH} fill={`url(#${id}-back-panel)`} />
              <path data-card-back-wave="top" d="M27 30h345v39c-48-7-95 26-148 19-57-8-111-51-197-18Z" fill={`url(#${id}-back-wave)`} opacity="0.88" />
              <path data-card-back-wave="bottom" d="M27 499c62-22 106 19 160 28 63 10 124-33 185-38v50H27Z" fill={`url(#${id}-back-wave)`} opacity="0.86" />
            </g>
          </svg>
          <div className="fd-card-design__back-content" data-testid="card-back-content">
            <div className="fd-card-design__back-tier-circle" data-testid="card-back-tier-circle">
              <span className="fd-card-design__back-tier-text font-super-water" data-testid="card-back-tier-text">{backTier}</span>
            </div>
          </div>
          <CarvedFoxMark className="fd-card-design__back-fox" filled testId="card-back-fox-mark" />
        </article>
      </div>
    </div>
  );
}

export function CardDesignReferencePreview(props: VocabularyCardDesignProps) {
  return <VocabularyCardDesign {...props} />;
}
