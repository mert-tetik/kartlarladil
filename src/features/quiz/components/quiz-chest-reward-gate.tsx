"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChestIcon } from "@/features/quiz/components/chest-icon";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import {
  CHEST_TIER_BUTTON_CLASSES,
  CHEST_TIER_TEXT_CLASSES,
  type ChestTierDefinition,
} from "@/features/quiz/chest-rewards";
import type { ChestRewardOutcome } from "@/features/gems/gem-types";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { playSoundEffect } from "@/lib/sound-effects";
import { cn } from "@/lib/utils";

const CHEST_OPENING_OVERLAY_READY_MS = 800;
const MISSED_CLOSE_STEP_MS = 150;
const MISSED_CLOSE_ELEMENT_MS = 150;
const MISSED_CLOSE_DURATION_MS = MISSED_CLOSE_STEP_MS * 3 + MISSED_CLOSE_ELEMENT_MS;

interface ChestOpeningMotion {
  left: number;
  top: number;
  width: number;
  height: number;
  deltaX: number;
  deltaY: number;
  moving: boolean;
}

interface QuizChestRewardGateProps {
  tier: ChestTierDefinition | null;
  totalPoints: number;
  accuracy: number;
  missedReason: string;
  missedProgress: string;
  onComplete: () => void;
  onRewardReady?: () => Promise<ChestRewardOutcome | null>;
}

export function QuizChestRewardGate({
  tier,
  totalPoints,
  accuracy,
  missedReason,
  missedProgress,
  onComplete,
  onRewardReady,
}: QuizChestRewardGateProps) {
  const t = useT();
const { locale } = useLocale();
  const [opening, setOpening] = useState(false);
  const [openingVisible, setOpeningVisible] = useState(false);
  const [openingFullyVisible, setOpeningFullyVisible] = useState(false);
  const [chestLanded, setChestLanded] = useState(false);
  const [landingCrackVisible, setLandingCrackVisible] = useState(false);
  const [chestOpeningMotion, setChestOpeningMotion] = useState<ChestOpeningMotion | null>(null);
  const [missedClosing, setMissedClosing] = useState(false);
  const chestMotionRef = useRef<HTMLDivElement | null>(null);
  const openingFrameRef = useRef<number | null>(null);
  const openingReadyTimeoutRef = useRef<number | null>(null);
  const missedCloseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (openingFrameRef.current !== null) {
        window.cancelAnimationFrame(openingFrameRef.current);
      }
      if (openingReadyTimeoutRef.current !== null) {
        window.clearTimeout(openingReadyTimeoutRef.current);
      }
      if (missedCloseTimeoutRef.current !== null) {
        window.clearTimeout(missedCloseTimeoutRef.current);
      }
    };
  }, []);

  const handleOpen = () => {
    if (!tier || opening) return;

    const chestRect = chestMotionRef.current?.getBoundingClientRect();
    if (chestRect) {
      setChestOpeningMotion({
        left: chestRect.left,
        top: chestRect.top,
        width: chestRect.width,
        height: chestRect.height,
        deltaX: window.innerWidth / 2 - (chestRect.left + chestRect.width / 2),
        deltaY: window.innerHeight / 2 - (chestRect.top + chestRect.height / 2),
        moving: false,
      });
    }

    setOpening(true);
    setOpeningFullyVisible(false);
    openingFrameRef.current = window.requestAnimationFrame(() => {
      openingFrameRef.current = null;
      setOpeningVisible(true);
      openingFrameRef.current = window.requestAnimationFrame(() => {
        openingFrameRef.current = null;
        setChestOpeningMotion((motion) => (motion ? { ...motion, moving: true } : motion));
      });
      openingReadyTimeoutRef.current = window.setTimeout(() => {
        openingReadyTimeoutRef.current = null;
        setOpeningFullyVisible(true);
      }, CHEST_OPENING_OVERLAY_READY_MS);
    });
  };

  const handleMissedContinue = () => {
    if (missedClosing) return;

    setMissedClosing(true);
    missedCloseTimeoutRef.current = window.setTimeout(() => {
      missedCloseTimeoutRef.current = null;
      onComplete();
    }, MISSED_CLOSE_DURATION_MS);
  };

  const formatCopy = (text: string) =>
    canUseSuperWater(locale) ? formatSuperWaterText(locale, text) : text;

  const handleChestLanding = () => {
    setChestLanded(true);
    setLandingCrackVisible(true);
    playSoundEffect("chest-crack");
  };

  const rewardGate = (
    <div
      data-quiz-chest-reward-gate
      className={cn(
        "relative flex h-full min-h-full w-full flex-col items-center justify-center overflow-hidden bg-[var(--background)] px-5 pb-28 pt-10 text-center text-foreground",
        opening && "bg-transparent",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/20 to-transparent" />

      {tier ? (
        <div className="relative z-10 flex w-full flex-col items-center gap-3">
          <div
            ref={chestMotionRef}
            className={cn(
              chestOpeningMotion && opening ? "fixed z-30 m-0" : "-translate-y-[90px]",
            )}
            style={
              chestOpeningMotion && opening
                ? {
                    left: chestOpeningMotion.left,
                    top: chestOpeningMotion.top,
                    width: chestOpeningMotion.width,
                    height: chestOpeningMotion.height,
                    transform: chestOpeningMotion.moving
                      ? `translate3d(${chestOpeningMotion.deltaX}px, ${chestOpeningMotion.deltaY}px, 0) scale(1.06)`
                      : "translate3d(0, 0, 0) scale(1)",
                    transition: chestOpeningMotion.moving
                      ? "transform 760ms cubic-bezier(0.85, 0, 0.15, 1)"
                      : "none",
                  }
                : undefined
            }
          >
            <div
              className={cn(
                !chestLanded && "quiz-chest-reward-drop",
                "relative mx-auto size-[clamp(13rem,56vw,23rem)] self-center",
              )}
              onAnimationEnd={handleChestLanding}
            >
              {landingCrackVisible ? (
                <div
                  className={cn(
                    "pointer-events-none absolute left-1/2 top-[calc(58%+90px)] z-0 -ml-[10px] aspect-[2/1] w-[175%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200",
                    opening && "opacity-0",
                  )}
                >
                  <Image
                    src="/chests/crack.png"
                    alt=""
                    fill
                    sizes="(max-width: 640px) 98vw, 640px"
                    className="object-contain"
                    aria-hidden="true"
                  />
                </div>
              ) : null}
              <ChestIcon
                tier={tier.tier}
                className="relative z-10 size-full"
                priority
                sizes="(max-width: 640px) 56vw, 368px"
              />
            </div>
          </div>
          <div
            className={cn(
              opening && "quiz-chest-reward-ui-exit",
              "translate-y-[20px]",
            )}
          >
            <p
              className={cn(
                chestLanded
                  ? "quiz-chest-reward-title-enter"
                  : "opacity-0",
                "relative top-[100px] text-[3.15rem] font-bold uppercase text-white sm:text-[5.25rem]",
                canUseSuperWater(locale) && "font-super-water",
              )}
              style={{ animationDelay: chestLanded ? "50ms" : undefined }}
            >
              {formatSuperWaterUppercaseText(locale, t("chest.rewardTitle"))}
            </p>
          </div>
          <p
            className={cn(
              opening
                ? "quiz-chest-reward-ui-exit"
                : chestLanded
                ? "quiz-chest-reward-label-enter"
                : "opacity-0",
              "relative top-[10px] text-4xl font-bold sm:text-6xl",
              CHEST_TIER_TEXT_CLASSES[tier.tier],
              canUseSuperWater(locale) && "font-super-water",
            )}
            style={{ animationDelay: chestLanded ? "190ms" : undefined }}
          >
            {formatSuperWaterText(locale, t(tier.labelKey))}
          </p>
          <div
            className={cn(
              opening
                ? "quiz-chest-reward-ui-exit"
                : chestLanded
                  ? "quiz-chest-reward-button-enter"
                  : "opacity-0",
              "flex",
            )}
            style={{ animationDelay: chestLanded ? "330ms" : undefined }}
          >
            <button
              type="button"
              onClick={handleOpen}
              disabled={opening}
              className={cn(
                "flex h-14 min-w-52 translate-y-[80px] items-center justify-center rounded-xl px-7 text-lg font-bold uppercase text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-[filter,transform] duration-200 hover:brightness-105 active:translate-y-[84px] active:shadow-[0_2px_0_rgba(0,0,0,0.25)] disabled:pointer-events-none disabled:opacity-0 sm:h-16 sm:text-xl",
                CHEST_TIER_BUTTON_CLASSES[tier.tier],
                canUseSuperWater(locale) && "font-super-water",
              )}
            >
              {formatSuperWaterUppercaseText(locale, t("quiz.openChest"))}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex max-w-xl flex-col items-center gap-7">
          <div
            className={cn(
              missedClosing
                ? "quiz-chest-missed-stamp-exit"
                : "quiz-chest-missed-stamp-enter",
              "border-[5px] border-rose-500 px-5 py-3 text-3xl font-bold uppercase leading-none text-rose-500 sm:text-5xl",
              canUseSuperWater(locale) && "font-super-water",
            )}
          >
            {formatSuperWaterUppercaseText(locale, t("chest.missed"))}
          </div>
          <div className="max-w-md translate-y-[30px] space-y-2 text-base font-semibold text-white/75 sm:text-lg">
            <p
              className={missedClosing
                ? "quiz-chest-missed-detail-exit"
                : "quiz-chest-missed-detail-enter"}
              style={{ animationDelay: missedClosing ? `${MISSED_CLOSE_STEP_MS}ms` : "680ms" }}
            >
              {formatCopy(missedReason)}
            </p>
            <p
              className={cn(
                missedClosing
                  ? "quiz-chest-missed-detail-exit"
                  : "quiz-chest-missed-detail-enter",
                "text-white/55",
              )}
              style={{ animationDelay: missedClosing ? `${MISSED_CLOSE_STEP_MS * 2}ms` : "840ms" }}
            >
              {formatCopy(missedProgress)}
            </p>
            <span className="sr-only">{formatNumber(locale, accuracy)}%</span>
          </div>
        </div>
      )}

      {!tier ? (
        <button
          type="button"
          onClick={handleMissedContinue}
          className={cn(
            "absolute inset-x-5 bottom-[calc(1.5rem+30px+env(safe-area-inset-bottom))] z-20 mx-auto flex h-14 max-w-md items-center justify-center rounded-xl bg-rose-500 px-5 text-lg font-bold uppercase text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-[filter,transform] duration-200 active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.25)] sm:h-16 sm:text-xl",
            missedClosing ? "quiz-chest-missed-button-exit" : "quiz-chest-missed-button-enter",
            canUseSuperWater(locale) && "font-super-water",
          )}
          style={{ animationDelay: missedClosing ? `${MISSED_CLOSE_STEP_MS * 3}ms` : "1000ms" }}
        >
          {formatSuperWaterUppercaseText(locale, t("quiz.continue"))}
        </button>
      ) : null}
    </div>
  );

  if (!opening) {
    return rewardGate;
  }

  return (
    <div className="relative h-full min-h-full w-full overflow-hidden bg-[var(--background)]">
      <div
        className={cn(
          "absolute inset-0 z-0",
          openingFullyVisible && "pointer-events-none opacity-0",
        )}
      >
        {rewardGate}
      </div>
      <div
        className={cn(
          "absolute inset-0 z-10 overflow-hidden",
          openingVisible ? "quiz-chest-opening-overlay-enter" : "pointer-events-none opacity-0",
        )}
      >
        <ChestOpeningView
          tier={tier!}
          totalPoints={totalPoints}
          enterWithCss={false}
          onComplete={onComplete}
          onRewardReady={onRewardReady}
        />
      </div>
    </div>
  );
}
