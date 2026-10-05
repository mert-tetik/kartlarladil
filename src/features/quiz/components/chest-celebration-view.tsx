"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import Image from "next/image";
import { useLocale } from "@/i18n/locale-provider";
import { TIER_REQUIREMENTS } from "@/data/tiers";
import { cn } from "@/lib/utils";
import { canUseSuperWater, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { getNativeMediaFallbackSource, isNativeMediaFallbackSource } from "@/lib/native-media-fallback";
import { vibrate } from "@/lib/vibration";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import type { VocabularyCard } from "@/types/domain";

interface ChestCelebrationViewProps {
  onComplete: () => void;
  learnedCards?: readonly VocabularyCard[];
  advancedCards?: readonly VocabularyCard[];
  advancedCardProgress?: Readonly<Record<string, number>>;
  preserveMessageOnComplete?: boolean;
}

const CELEBRATION_MESSAGE_KEYS = [
  "quiz.chestCelebration1",
  "quiz.chestCelebration2",
  "quiz.chestCelebration3",
  "quiz.chestCelebration4",
] as const satisfies readonly string[];

const CELEBRATION_ENTER_DELAY_MS = 50;
const CELEBRATION_MESSAGE_EARLY_START_MS = 450;
const CELEBRATION_VIDEO_ERROR_FALLBACK_DELAY_MS = 750;
const CELEBRATION_MESSAGE_DELAY_MS = 1000;
const CELEBRATION_MESSAGE_EXIT_DURATION_MS = 420;
const RESULT_SUMMARY_PANEL_ENTER_DURATION_MS = 1400;
const RESULT_SUMMARY_CONTENT_DELAY_MS = 80;
const CELEBRATION_COMPLETE_DELAY_MS = 500;
const RESULT_MESSAGE_WAVE_SRC = "/quiz/result-message-wave-20261003-1.png";
const RESULT_MESSAGE_WAVE_HEIGHT_CSS = "177.9167vw";

export function ChestCelebrationView({
  onComplete,
  learnedCards = [],
  advancedCards = [],
  advancedCardProgress,
  preserveMessageOnComplete = false,
}: ChestCelebrationViewProps) {
  const { locale, t } = useLocale();
  const [viewVisible, setViewVisible] = useState(false);
  const [messageVisible, setMessageVisible] = useState(false);
  const [summaryPanelVisible, setSummaryPanelVisible] = useState(false);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryExiting, setSummaryExiting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [videoSource, setVideoSource] = useState(
    "/quiz/result_message_video.mp4?v=20261004-2",
  );
  const [videoUnavailable, setVideoUnavailable] = useState(false);
  const [messageKey] = useState(() =>
    CELEBRATION_MESSAGE_KEYS[Math.floor(Math.random() * CELEBRATION_MESSAGE_KEYS.length)],
  );
  const completeRef = useRef(onComplete);
  const videoFinishedRef = useRef(false);
  const messageShownRef = useRef(false);
  const earlyMessageTimerRef = useRef<number | null>(null);
  const videoErrorTimerRef = useRef<number | null>(null);
  const messageTimerRef = useRef<number | null>(null);
  const summaryTimerRef = useRef<number | null>(null);
  const summaryContentTimerRef = useRef<number | null>(null);
  const summaryMessageHideTimerRef = useRef<number | null>(null);
  const summaryAutoCompleteTimerRef = useRef<number | null>(null);
  const completeTimerRef = useRef<number | null>(null);
  const completionStartedRef = useRef(false);
  const hasSummaryCards = learnedCards.length > 0 || advancedCards.length > 0;

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const showMessage = () => {
    if (messageShownRef.current) return;
    messageShownRef.current = true;
    setMessageVisible(true);
  };

  const completeView = useCallback(() => {
    if (completionStartedRef.current) return;
    completionStartedRef.current = true;

    if (preserveMessageOnComplete) {
      setSummaryExiting(true);
      setSummaryVisible(false);
    } else {
      setClosing(true);
    }

    completeTimerRef.current = window.setTimeout(
      () => completeRef.current?.(),
      preserveMessageOnComplete && !hasSummaryCards
        ? 0
        : CELEBRATION_COMPLETE_DELAY_MS,
    );
  }, [hasSummaryCards, preserveMessageOnComplete]);

  const showSummary = () => {
    summaryTimerRef.current = window.setTimeout(() => {
      summaryTimerRef.current = null;
      setSummaryPanelVisible(true);
      summaryMessageHideTimerRef.current = window.setTimeout(() => {
        summaryMessageHideTimerRef.current = null;
        setMessageVisible(false);
      }, RESULT_SUMMARY_PANEL_ENTER_DURATION_MS);
      if (hasSummaryCards) {
        summaryContentTimerRef.current = window.setTimeout(() => {
          summaryContentTimerRef.current = null;
          setSummaryVisible(true);
        }, RESULT_SUMMARY_PANEL_ENTER_DURATION_MS + RESULT_SUMMARY_CONTENT_DELAY_MS);
      }
    }, CELEBRATION_MESSAGE_EXIT_DURATION_MS);
  };

  const closeView = () => {
    if (!summaryVisible || closing) return;
    completeView();
  };

  useEffect(() => {
    if (!preserveMessageOnComplete || hasSummaryCards || !summaryPanelVisible) return;

    summaryAutoCompleteTimerRef.current = window.setTimeout(
      () => {
        summaryAutoCompleteTimerRef.current = null;
        completeView();
      },
      RESULT_SUMMARY_PANEL_ENTER_DURATION_MS,
    );

    return () => {
      if (summaryAutoCompleteTimerRef.current !== null) {
        window.clearTimeout(summaryAutoCompleteTimerRef.current);
        summaryAutoCompleteTimerRef.current = null;
      }
    };
  }, [completeView, hasSummaryCards, preserveMessageOnComplete, summaryPanelVisible]);

  const finishVideo = () => {
    if (videoFinishedRef.current) return;
    videoFinishedRef.current = true;
    if (earlyMessageTimerRef.current !== null) {
      window.clearTimeout(earlyMessageTimerRef.current);
    }
    showMessage();
    messageTimerRef.current = window.setTimeout(() => {
      messageTimerRef.current = null;
      showSummary();
    }, CELEBRATION_MESSAGE_DELAY_MS);
  };

  const handleVideoLoadedMetadata = (event: SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (!Number.isFinite(video.duration)) return;
    earlyMessageTimerRef.current = window.setTimeout(
      showMessage,
      Math.max(0, video.duration * 1000 - CELEBRATION_MESSAGE_EARLY_START_MS),
    );
  };

  const handleVideoError = () => {
    if (!isNativeMediaFallbackSource(videoSource)) {
      setVideoSource(getNativeMediaFallbackSource(videoSource));
      return;
    }
    setVideoUnavailable(true);
    if (videoErrorTimerRef.current !== null) return;
    videoErrorTimerRef.current = window.setTimeout(
      finishVideo,
      CELEBRATION_VIDEO_ERROR_FALLBACK_DELAY_MS,
    );
  };

  useEffect(() => {
    const enterTimer = window.setTimeout(
      () => setViewVisible(true),
      CELEBRATION_ENTER_DELAY_MS,
    );

    return () => {
      window.clearTimeout(enterTimer);
      if (earlyMessageTimerRef.current !== null) {
        window.clearTimeout(earlyMessageTimerRef.current);
      }
      if (videoErrorTimerRef.current !== null) {
        window.clearTimeout(videoErrorTimerRef.current);
      }
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
      }
      if (summaryTimerRef.current !== null) {
        window.clearTimeout(summaryTimerRef.current);
      }
      if (summaryContentTimerRef.current !== null) {
        window.clearTimeout(summaryContentTimerRef.current);
      }
      if (summaryMessageHideTimerRef.current !== null) {
        window.clearTimeout(summaryMessageHideTimerRef.current);
      }
      if (summaryAutoCompleteTimerRef.current !== null) {
        window.clearTimeout(summaryAutoCompleteTimerRef.current);
      }
      if (completeTimerRef.current !== null) {
        window.clearTimeout(completeTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={cn(
        "relative isolate flex h-full w-full flex-1 items-center justify-center overflow-hidden bg-[var(--background)] p-4 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        closing
          ? "opacity-0"
          : viewVisible
            ? "opacity-100"
            : "opacity-0",
      )}
      data-chest-celebration-view
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[var(--background)]"
        aria-hidden="true"
        data-chest-celebration-background
      >
        {!videoUnavailable ? <video
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-150 ease-linear",
            viewVisible ? "opacity-100" : "opacity-0",
          )}
          key={videoSource}
          src={videoSource}
          autoPlay
          onEnded={finishVideo}
          onError={handleVideoError}
          onLoadedMetadata={handleVideoLoadedMetadata}
          playsInline
          preload="auto"
          data-chest-celebration-video
        /> : null}
      </div>
      <div
        className={cn(
          "relative z-10 flex max-w-[22rem] items-center justify-center text-center sm:max-w-xl",
          closing
            ? "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] scale-[1.025] opacity-0"
            : "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          messageVisible && !closing ? "translate-y-0 opacity-100" : !closing && "-translate-y-6 opacity-0",
        )}
      >
        <p
          className={cn(
            "text-balance text-5xl font-bold uppercase leading-tight text-white [filter:grayscale(1)_brightness(0)_invert(1)] sm:text-7xl",
            canUseSuperWater(locale) && "font-super-water",
          )}
          data-chest-celebration-message
        >
          {formatSuperWaterUppercaseText(locale, t(messageKey))}
        </p>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-20 overflow-visible bg-[var(--background)] transform-gpu transition-transform duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={{
          transform: closing
            ? "translateY(100%)"
            : summaryPanelVisible
              ? "translateY(0)"
              : `translateY(calc(100% + ${RESULT_MESSAGE_WAVE_HEIGHT_CSS}))`,
        }}
        data-quiz-result-summary-panel
      >
        <Image
          src={RESULT_MESSAGE_WAVE_SRC}
          alt=""
          aria-hidden="true"
          width={480}
          height={854}
          sizes="100vw"
          className={cn(
            "pointer-events-none absolute bottom-full left-0 z-0 block h-auto w-full max-w-none select-none opacity-100",
          )}
        />
        <div
          className={cn(
            "absolute inset-x-0 top-0 bottom-20 overflow-hidden px-4 pb-8 pt-8 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-6 sm:pt-10",
            summaryVisible && !closing
              ? "translate-y-0 opacity-100"
              : "translate-y-6 opacity-0",
          )}
          data-chest-celebration-summary
        >
          <div className="pointer-events-auto h-full min-h-0 w-full overflow-y-auto overscroll-contain">
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center gap-8 p-4 sm:p-6">
              {learnedCards.length > 0 ? (
                <AchievementCardSection
                  title={t("quiz.resultLearned")}
                  cards={learnedCards}
                  tone="learned"
                  locale={locale}
                  reveal={summaryVisible}
                  exiting={summaryExiting}
                  staggerOffsetMs={0}
                />
              ) : null}
              {advancedCards.length > 0 ? (
                <AchievementCardSection
                  title={t("quiz.resultAdvanced")}
                  cards={advancedCards}
                  tone="advanced"
                  locale={locale}
                  progressByCardId={advancedCardProgress}
                  reveal={summaryVisible}
                  exiting={summaryExiting}
                  staggerOffsetMs={learnedCards.length > 0 ? 850 : 0}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-8">
          <button
            type="button"
            onClick={closeView}
            disabled={!summaryVisible || closing}
            className={cn(
              "pointer-events-auto mx-auto block h-14 w-full max-w-md rounded-2xl bg-brand px-5 text-lg font-bold uppercase text-brand-foreground shadow-[0_6px_0_var(--brand-hover)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:pointer-events-none sm:h-16",
              canUseSuperWater(locale) && "font-super-water",
              summaryVisible && !closing ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
            )}
          >
            {formatSuperWaterUppercaseText(locale, t("quiz.continue"))}
          </button>
        </div>
      </div>
    </div>
  );
}

function AchievementCardSection({
  title,
  cards,
  tone,
  locale,
  progressByCardId,
  reveal,
  exiting,
  staggerOffsetMs,
}: {
  title: string;
  cards: readonly VocabularyCard[];
  tone: "learned" | "advanced";
  locale: Parameters<typeof formatSuperWaterUppercaseText>[0];
  progressByCardId?: Readonly<Record<string, number>>;
  reveal: boolean;
  exiting: boolean;
  staggerOffsetMs: number;
}) {
  const [faceDownCardIds, setFaceDownCardIds] = useState<Set<string>>(() => new Set());

  const handleCardClick = (cardId: string) => {
    vibrate("flip");
    setFaceDownCardIds((current) => {
      const next = new Set(current);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl p-3 sm:p-4"
      style={{ "--result-stagger-delay": `${staggerOffsetMs}ms` } as CSSProperties}
      data-chest-achievement-section={tone}
    >
      <h2
        className={cn(
          "text-center text-3xl font-bold uppercase sm:text-4xl",
          exiting ? "result-stagger-exit" : reveal ? "result-stagger-enter" : "result-stagger-pending",
          canUseSuperWater(locale) && "font-super-water",
          tone === "learned" ? "text-sky-400" : "text-emerald-400",
        )}
        style={{ "--result-stagger-delay": `${staggerOffsetMs + 80}ms` } as CSSProperties}
      >
        {formatSuperWaterUppercaseText(locale, title)}
      </h2>
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 lg:grid-cols-6">
        {cards.map((card, index) => (
          <div
            key={card.id}
            className={cn(
              "relative aspect-[5/6] min-w-0",
              exiting ? "result-stagger-exit" : reveal ? "result-stagger-enter" : "result-stagger-pending",
            )}
            style={{
              "--result-stagger-delay": `${staggerOffsetMs + 150 + index * 55}ms`,
            } as CSSProperties}
          >
            <VocabularyCardView
              card={card}
              face={faceDownCardIds.has(card.id) ? "back" : "front"}
              onClick={() => handleCardClick(card.id)}
              compact
              owned={false}
              showActions={false}
              footerMode="empty"
              frontMinimal
              frontFit
              primaryTranslationOnly
              memoryGame
              summaryCard
              summaryProgressCount={
                tone === "advanced"
                  ? progressByCardId?.[card.id] ?? Math.max(1, TIER_REQUIREMENTS[card.tier] - 1)
                  : undefined
              }
              className="h-full min-h-0 w-full"
            />
          </div>
        ))}
      </div>
    </section>
  );
}
