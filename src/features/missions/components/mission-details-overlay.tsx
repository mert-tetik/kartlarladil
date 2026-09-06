"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ArrowRight, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { ScoreIcon } from "@/components/score-icon";
import { useAuthSession } from "@/features/auth/auth-client";
import { ChestIcon } from "@/features/quiz/components/chest-icon";
import { getChestLabelKey } from "@/features/quiz/chest-rewards";
import {
  canUseSuperWater,
  formatSuperWaterText,
  formatSuperWaterUppercaseText,
} from "@/lib/super-water";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import {
  getMissionCardBackground,
  getMissionDescription,
  getMissionPointTier,
  PointsRewardStack,
} from "./mission-card";
import { resolveMissionNavigation, type MissionNavigationTarget } from "../mission-navigation";
import type { MissionDefinition, MissionStatus } from "@/features/missions/mission-types";

const CLOSE_ANIMATION_MS = 860;
const CONTENT_ENTER_DELAY_MS = 520;
const CONTENT_STEP_MS = 70;
const CONTENT_ANIMATION_MS = 360;

export interface MissionDetailsData {
  missionId: string;
  index: number;
  type: MissionDefinition["type"];
  requirement: number;
  progress: number;
  status: MissionStatus;
  reward: MissionDefinition["reward"];
  game?: MissionDefinition["game"];
  characterId?: MissionDefinition["characterId"];
}

interface MissionDetailsOverlayProps {
  mission: MissionDetailsData | null;
  sourceRect: DOMRect | null;
  onClose: () => void;
  onNavigate: (target: MissionNavigationTarget) => void;
}

export function MissionDetailsOverlay({ mission, sourceRect, onClose, onNavigate }: MissionDetailsOverlayProps) {
  const t = useT();
  const { locale } = useLocale();
  const { user } = useAuthSession();
  const [closing, setClosing] = useState(false);
  const [animationStarted, setAnimationStarted] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mission) return;

    setClosing(false);
    setAnimationStarted(false);
    const animationFrame = window.requestAnimationFrame(() => setAnimationStarted(true));

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, [mission]);

  useEffect(() => {
    if (!mission) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  if (!mission || typeof document === "undefined") return null;

  const activeMission = mission;

  const isClaimed = activeMission.status === "claimed";
  const isLocked = activeMission.status === "locked";
  const isChestReward = activeMission.reward.kind === "chest";
  const progressPercent = Math.min(100, Math.round((activeMission.progress / activeMission.requirement) * 100));
  const description = getMissionDescription(
    t,
    activeMission.type,
    activeMission.requirement,
    locale,
    activeMission.game,
    activeMission.characterId,
  );
  const descriptionDisplay = formatSuperWaterText(locale, description);
  const statusText = formatSuperWaterUppercaseText(locale, t(isClaimed ? "missions.claimed" : "missions.locked"));
  const rewardText = activeMission.reward.kind === "chest"
    ? t("missions.reward.chest", { tier: t(getChestLabelKey(activeMission.reward.tier)) })
    : t("missions.reward.points", { count: activeMission.reward.amount });
  const contentItemCount = isLocked ? 4 : 3;
  const originX = sourceRect ? sourceRect.left + sourceRect.width / 2 : window.innerWidth / 2;
  const originY = sourceRect ? sourceRect.top + sourceRect.height / 2 : window.innerHeight / 2;
  const overlayStyle = {
    transformOrigin: `${originX}px ${originY}px`,
    backgroundImage: getMissionCardBackground(activeMission.index, isClaimed),
  } satisfies CSSProperties;
  const preferredLanguage = user?.profile.preferredLanguageCode ?? "en";

  function closeOverlay(afterClose?: () => void) {
    if (closing) return;
    setAnimationStarted(true);
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
      afterClose?.();
    }, CLOSE_ANIMATION_MS);
  }

  function handleMissionAction() {
    const target = resolveMissionNavigation(activeMission, preferredLanguage);
    if (!target) return;
    closeOverlay(() => onNavigate(target));
  }

  const renderContentItem = (
    index: number,
    children: ReactNode,
    className?: string,
  ) => (
    <div
      className={cn("mission-details-overlay__item", className)}
      style={{
        animationDelay: closing
          ? `${(contentItemCount - index - 1) * CONTENT_STEP_MS}ms`
          : `${CONTENT_ENTER_DELAY_MS + index * CONTENT_STEP_MS}ms`,
      }}
    >
      {children}
    </div>
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={description}
      data-mission-details-overlay
      data-mission-details-state={closing ? "closing" : "open"}
      className={cn(
        "mission-details-overlay fixed inset-0 z-[100] overflow-y-auto overscroll-contain text-white",
        !animationStarted && "mission-details-overlay--preparing",
        closing && "mission-details-overlay--closing",
      )}
      style={overlayStyle}
    >
      <div className="relative flex min-h-full w-full flex-col items-center px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-8">
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={() => closeOverlay()}
          className={cn(
            "mission-details-overlay__item absolute right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 inline-flex size-14 items-center justify-center text-white transition-transform hover:scale-105 active:scale-95 sm:right-6",
            closing && "mission-details-overlay__item--close-control",
          )}
          style={{
            animationDelay: closing
              ? `${contentItemCount * CONTENT_STEP_MS}ms`
              : `${CONTENT_ENTER_DELAY_MS + contentItemCount * CONTENT_STEP_MS}ms`,
          }}
        >
          <X className="size-10" strokeWidth={3.5} aria-hidden="true" />
        </button>

        <div className="flex min-h-[calc(100svh-2rem)] w-full max-w-[48rem] flex-1 flex-col items-center justify-center gap-5 py-16 text-center sm:gap-7 sm:py-20">
          {renderContentItem(
            0,
            <div className="max-w-[32rem] translate-y-5 px-4">
              <div className="flex items-center justify-center gap-3 text-white">
                <p className={cn(
                  "text-[clamp(3.5rem,16vw,6rem)] font-bold uppercase leading-none text-white",
                  canUseSuperWater(locale) && "font-super-water",
                )}>
                  {statusText}
                </p>
                {isLocked ? (
                  <Image
                    src="/missions/mission-lock-icon-v3.png"
                    alt=""
                    width={64}
                    height={64}
                    className="size-[clamp(3rem,12vw,4.5rem)] shrink-0 object-contain"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
              <h1 className={cn(
                "mt-4 text-[clamp(1.35rem,5.5vw,2.35rem)] font-bold leading-tight text-white",
                canUseSuperWater(locale) && "font-super-water",
              )}>
                {descriptionDisplay}
              </h1>
            </div>,
          )}

          {renderContentItem(
            1,
            <div className="relative flex min-h-[15rem] w-full -translate-y-5 flex-col items-center justify-center">
              {activeMission.reward.kind === "chest" ? (
                <div className="flex -translate-y-8 flex-col items-center">
                  <ChestIcon
                    tier={activeMission.reward.tier}
                    hideLid={isClaimed}
                    priority
                    sizes="(min-width: 640px) 14rem, 12rem"
                    className="size-[12rem] sm:size-[14rem]"
                  />
                  <p className="mt-3 text-xl font-bold text-white">
                    {formatSuperWaterText(locale, rewardText)}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex min-h-[10.625rem] min-w-[16.5rem] items-center justify-center">
                    <PointsRewardStack
                      tier={getMissionPointTier(activeMission.reward.amount)}
                      className="scale-[1.7]"
                    />
                  </div>
                  <p className={cn(
                    "relative -top-8 mt-8 text-3xl font-bold text-white sm:mt-10 sm:text-4xl",
                    canUseSuperWater(locale) && "font-super-water",
                  )}>
                    {formatSuperWaterText(locale, rewardText)}
                  </p>
                </div>
              )}
            </div>,
            "w-full",
          )}

          {renderContentItem(
            2,
            <div
              className={cn(
                "relative left-1/2 -translate-x-1/2",
                isChestReward ? "-translate-y-10" : "-top-16",
              )}
              style={{
                width: "calc(100% + 1rem)",
                maxWidth: "calc(100vw - 1.5rem)",
              }}
            >
              <div className="mb-2 flex items-center justify-between gap-6 text-sm font-bold text-white/90">
                <span>{t("missions.progressLabel", { progress: activeMission.progress, requirement: activeMission.requirement })}</span>
                <span className="shrink-0">{progressPercent}%</span>
              </div>
              <Progress
                value={progressPercent}
                className="h-3 w-full bg-black/25 [&>div]:bg-white"
                aria-label={t("missions.progressLabel", { progress: activeMission.progress, requirement: activeMission.requirement })}
              />
            </div>,
            "w-full",
          )}

          {isLocked ? renderContentItem(
            3,
            <button
              type="button"
              onClick={handleMissionAction}
              className={cn(
                "relative -top-16 inline-flex min-h-14 w-full max-w-[28rem] items-center justify-center gap-3 rounded-full bg-white px-6 py-3 text-center text-lg font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98]",
                canUseSuperWater(locale) && "font-super-water",
              )}
            >
              <span>{descriptionDisplay}</span>
              <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
            </button>,
            "w-full px-4",
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
