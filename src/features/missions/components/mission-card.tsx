"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ScoreIcon } from "@/components/score-icon";
import { Progress } from "@/components/ui/progress";
import { useAuthSession } from "@/features/auth/auth-client";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import { vibrate } from "@/lib/vibration";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { AI_PRACTICE_CHARACTERS } from "@/features/ai-practice/ai-practice-data";
import { ChestIcon } from "@/features/quiz/components/chest-icon";
import type { MissionDefinition, MissionStatus } from "@/features/missions/mission-types";

const MISSION_CARD_GRADIENTS = [
  { top: "#008f6a", bottom: "#14d49a" },
  { top: "#145de0", bottom: "#35baf5" },
  { top: "#7b1bd1", bottom: "#c05cff" },
  { top: "#d41448", bottom: "#ff5577" },
  { top: "#d97900", bottom: "#ffc928" },
  { top: "#e74a05", bottom: "#ff972f" },
] as const;

const MISSION_POINT_TIER_LIMITS = [125, 375] as const;

function getMissionPointTier(amount: number) {
  if (amount <= MISSION_POINT_TIER_LIMITS[0]) return 1;
  if (amount <= MISSION_POINT_TIER_LIMITS[1]) return 3;
  return 5;
}

interface MissionCardProps {
  missionId: string;
  index: number;
  type: MissionDefinition["type"];
  requirement: number;
  progress: number;
  status: MissionStatus;
  reward: MissionDefinition["reward"];
  game?: MissionDefinition["game"];
  characterId?: MissionDefinition["characterId"];
  onClaim: (source?: DOMRect) => void;
  claiming: boolean;
}

export function MissionCard({
  missionId,
  index,
  type,
  requirement,
  progress,
  status,
  reward,
  game,
  characterId,
  onClaim,
  claiming,
}: MissionCardProps) {
  const t = useT();
  const router = useRouter();
  const { user } = useAuthSession();
  const { locale } = useLocale();
  const progressPercent = Math.min(100, Math.round((progress / requirement) * 100));
  const isWaiting = status === "waiting";
  const isClaimed = status === "claimed";
  const isLocked = status === "locked";
  const isClickable = (isWaiting && !claiming) || isLocked;
  const gradient = MISSION_CARD_GRADIENTS[index % MISSION_CARD_GRADIENTS.length];
  const description = getMissionDescription(t, type, requirement, locale, game, characterId);
  const descriptionDisplay = canUseSuperWater(locale)
    ? formatSuperWaterText(locale, description)
    : description;

  function navigateToMission() {
    const preferredLanguage = user?.profile.preferredLanguageCode ?? "en";

    switch (type) {
      case "add_cards":
        navigateWithRouteTransition(() => router.push("/card-draw"));
        break;
      case "learn_cards":
        navigateWithRouteTransition(() => router.push(`/learn?mode=active&language=${encodeURIComponent(preferredLanguage)}`));
        break;
      case "game_level":
        navigateWithRouteTransition(() => router.push("/games"));
        break;
      case "ai_practice":
        navigateWithRouteTransition(() => router.push("/ai-practice"));
        break;
      default:
        break;
    }
  }

  function handleClick(source?: DOMRect) {
    if (claiming) return;

    if (isWaiting) {
      playSoundEffect("mission-claim");
      vibrate("tap");
      onClaim(source);
      return;
    }

    if (isLocked) {
      vibrate("tap");
      navigateToMission();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick(event.currentTarget.getBoundingClientRect());
    }
  }

  return (
    <div
      data-mission-card={missionId}
      data-mission-status={status}
      role="button"
      tabIndex={isClickable ? 0 : -1}
      aria-label={isWaiting ? t("missions.claim") : description}
      onClick={(event) => handleClick(event.currentTarget.getBoundingClientRect())}
      onKeyDown={handleKeyDown}
      style={{
        aspectRatio: "4 / 5",
        backgroundImage: isClaimed
          ? "linear-gradient(180deg, #303030 0%, #171717 100%)"
          : `linear-gradient(180deg, ${gradient.top} 0%, ${gradient.top} 42%, ${gradient.bottom} 100%)`,
      }}
      className={cn(
        "relative flex min-w-0 flex-col overflow-visible border border-white/15 px-3 py-3 text-center text-white shadow-none transition-transform duration-300 ease-out outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-white",
        isClaimed && "mission-card--claimed",
        canUseSuperWater(locale) && "font-super-water",
        isClickable && "cursor-pointer active:scale-[0.98]",
        claiming && "cursor-wait opacity-90",
      )}
    >
      {isWaiting ? <span aria-hidden="true" data-mission-card-shine className="mission-card-shine" /> : null}

      <div className="relative z-10 flex min-h-[3.25rem] items-center justify-center px-1 text-center">
        <p className="line-clamp-2 text-[0.86rem] font-bold leading-tight text-white">
          {descriptionDisplay}
        </p>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center py-3">
        {isWaiting && (
          <div
            className="pointer-events-none absolute -top-1 left-[calc(50%+5rem)] z-30 -translate-x-1/2 animate-mission-claim-bubble-pulse"
          >
            <div
              className={cn(
                "relative flex aspect-square w-[3.5rem] items-center justify-center bg-contain bg-center bg-no-repeat",
                canUseSuperWater(locale) && "font-super-water",
              )}
              style={{ backgroundImage: 'url("/missions/mission-claim-bubble-check-v4.png")' }}
            />
          </div>
        )}

        <div
          className={cn(
            "flex items-center justify-center transition-transform duration-300",
            isWaiting && !claiming && "animate-mission-reward-wiggle",
          )}
        >
          {reward.kind === "chest" ? (
            <ChestIcon tier={reward.tier} hideLid={isClaimed} className="size-[6.25rem] drop-shadow-sm" />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1">
              <PointsRewardStack tier={getMissionPointTier(reward.amount)} />
              <span className="text-xl font-bold leading-none text-white">+{reward.amount}</span>
            </div>
          )}
        </div>

        {isLocked ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center drop-shadow-sm">
            <Image
              src="/missions/mission-lock-icon-v3.png"
              alt=""
              width={128}
              height={128}
              className="h-[8rem] w-auto object-contain"
              aria-hidden="true"
            />
          </div>
        ) : null}
      </div>

      <div className="relative z-10 flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between text-[0.68rem] font-bold text-white/90">
            <span>
              {progress}/{requirement}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <Progress
            value={progressPercent}
            className={cn(
              "h-2 bg-black/20 [&>div]:bg-white",
              isLocked && "bg-black/40 [&>div]:bg-white/85",
            )}
            aria-label={t("missions.progressLabel", { progress, requirement })}
          />
        </div>
      </div>
    </div>
  );
}

function PointsRewardStack({ tier }: { tier: number }) {
  return (
    <div
      data-mission-point-stack
      data-mission-point-tier={tier}
      className="relative h-[6.25rem] w-[9.75rem]"
      aria-label={`${tier} point tier`}
    >
      {Array.from({ length: tier }, (_, index) => {
        const isFirst = index === 0;
        const side = index % 2 === 1 ? -1 : 1;
        const sideLayer = Math.ceil(index / 2);
        const horizontalSpacing = tier === 5 ? 1.75 : 0.85;
        const horizontalOffset = isFirst ? 0 : side * (1.35 + (sideLayer - 1) * horizontalSpacing);
        const verticalOffset = 0.75 - Math.min(index * 0.28, 1.1);
        const scale = Math.max(0.56, 1 - index * 0.12);
        const rotation = isFirst ? 0 : side * (5 + sideLayer * 2);

        return (
          <span
            key={index}
            className="absolute size-[4.85rem] drop-shadow-sm"
            style={{
              left: `calc(50% + ${horizontalOffset}rem)`,
              top: `${verticalOffset}rem`,
              transform: `translateX(-50%) scale(${scale}) rotate(${rotation}deg)`,
              transformOrigin: "50% 50%",
              zIndex: tier - index,
            }}
          >
            <ScoreIcon size={78} className="size-full" />
          </span>
        );
      })}
    </div>
  );
}

function getMissionDescription(
  t: ReturnType<typeof useT>,
  type: MissionDefinition["type"],
  requirement: number,
  locale: string,
  game?: MissionDefinition["game"],
  characterId?: MissionDefinition["characterId"],
) {
  switch (type) {
    case "add_cards":
      return t("missions.type.addCards", { count: requirement });
    case "learn_cards":
      return t("missions.type.learnCards", { count: requirement });
    case "game_level":
      return t("missions.type.gameLevel", { game: t(`games.${game ?? "memory"}.title`), level: requirement });
    case "ai_practice":
      return t("missions.type.aiPractice", { character: getCharacterName(characterId, locale) ?? t("missions.unknownCharacter") });
    default:
      return "";
  }
}

function getCharacterName(characterId: string | undefined, languageCode: string): string | undefined {
  if (!characterId) return undefined;
  const character = AI_PRACTICE_CHARACTERS.find((item) => item.id === characterId);
  if (!character) return undefined;
  return character.namesByLanguage[languageCode as import("@/types/domain").LanguageCode] ?? character.namesByLanguage.en;
}
