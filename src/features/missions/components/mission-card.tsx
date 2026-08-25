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

const MISSION_BUTTON_ASSETS: Record<MissionStatus, string> = {
  waiting: "/missions/mission-button-claimable.png",
  claimed: "/missions/mission-button-claimed-v2.png",
  locked: "/missions/mission-button-locked-v2.png",
};

interface MissionCardProps {
  missionId: string;
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
  const buttonAsset = MISSION_BUTTON_ASSETS[status];
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
        aspectRatio: "1144 / 290",
        backgroundImage: `url("${buttonAsset}")`,
      }}
      className={cn(
        "relative flex items-center gap-3 rounded-2xl border-0 bg-center bg-[length:100%_100%] bg-no-repeat px-[8%] py-3 shadow-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand",
        isLocked && "text-foreground",
        isWaiting && "text-white",
        isClaimed && "text-white",
        canUseSuperWater(locale) && "font-super-water",
        isClickable && "cursor-pointer active:scale-[0.98]",
        claiming && "cursor-wait opacity-90",
      )}
    >
      <div className="relative flex size-12 shrink-0 items-center justify-center">
        {isWaiting && (
          <div
            className="pointer-events-none absolute -top-[3.05rem] left-1/2 z-20 -translate-x-1/2 animate-mission-claim-bubble-pulse"
            style={{ left: "calc(50% + 2.75rem)" }}
          >
            <div
              className={cn(
                "relative flex aspect-square w-[3.5rem] items-center justify-center bg-contain bg-center bg-no-repeat",
                canUseSuperWater(locale) && "font-super-water",
              )}
              style={{ backgroundImage: 'url("/missions/mission-claim-bubble-check-v3.png")' }}
            />
          </div>
        )}

        <div
          className={cn(
            "transition-transform",
            isWaiting && !claiming && "animate-mission-reward-wiggle",
            isLocked && "opacity-50",
          )}
        >
          {reward.kind === "chest" ? (
            <ChestIcon tier={reward.tier} hideLid={isClaimed} />
          ) : (
            <ScoreIcon size={40} className="h-10 w-auto" />
          )}
        </div>

        {isLocked ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center drop-shadow-sm">
            <Image
              src="/missions/mission-lock-icon.png"
              alt=""
              width={36}
              height={50}
              className="h-10 w-auto object-contain"
              aria-hidden="true"
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="mx-auto flex w-[94%] items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm font-bold",
              isLocked ? "text-white" : "text-current",
            )}
          >
            {descriptionDisplay}
          </p>
          {reward.kind === "points" ? (
            <div
              className={cn(
                "shrink-0 flex items-center gap-1.5 text-sm font-bold",
                isLocked ? "text-white/90" : "text-white",
              )}
            >
              <span>{reward.amount}</span>
              <ScoreIcon size={18} className="h-[1.05rem] w-auto" />
            </div>
          ) : null}
        </div>

        <div className="ml-0 mr-auto flex w-[92%] flex-col gap-1">
          <div
            className={cn(
              "flex items-center justify-between text-xs font-semibold",
              isLocked ? "text-white/85" : "text-white/90",
            )}
          >
            <span>
              {progress}/{requirement}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <Progress
            value={progressPercent}
            className={cn(
              "h-2",
              isLocked ? "bg-black/45 [&>div]:bg-brand" : "[&>div]:bg-white bg-white/30",
            )}
            aria-label={t("missions.progressLabel", { progress, requirement })}
          />
        </div>
      </div>
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
