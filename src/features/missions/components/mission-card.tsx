"use client";

import { Lock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ScoreIcon } from "@/components/score-icon";
import { Progress } from "@/components/ui/progress";
import { useAuthSession } from "@/features/auth/auth-client";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { AI_PRACTICE_CHARACTERS } from "@/features/ai-practice/ai-practice-data";
import { ChestIcon } from "@/features/quiz/components/chest-icon";
import type { MissionDefinition, MissionStatus } from "@/features/missions/mission-types";

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

  const description = getMissionDescription(t, type, requirement, locale, game, characterId);

  function navigateToMission() {
    const preferredLanguage = user?.profile.preferredLanguageCode ?? "en";

    switch (type) {
      case "add_cards":
        router.push("/card-draw");
        break;
      case "learn_cards":
        router.push(`/learn?mode=active&language=${encodeURIComponent(preferredLanguage)}`);
        break;
      case "game_level":
        router.push("/games");
        break;
      case "ai_practice":
        router.push("/ai-practice");
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
      className={cn(
        "relative flex items-center gap-4 rounded-2xl border p-4 shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand",
        isLocked && "border-border bg-background-card opacity-70",
        isWaiting && "border-emerald-500 bg-emerald-500 text-white",
        isClaimed && "border-emerald-800/80 bg-emerald-800/80 text-white",
        isClickable && "cursor-pointer active:scale-[0.98]",
        claiming && "cursor-wait opacity-90",
      )}
    >
      <div className="relative flex size-14 shrink-0 items-center justify-center">
        {isWaiting && (
          <div className="absolute -top-7 left-1/2 z-20 animate-mission-claim-bubble-pulse">
            <div className="relative inline-flex items-center justify-center rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
              {claiming ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                t("missions.claim")
              )}
              <span
                className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rotate-45 bg-emerald-600"
                aria-hidden="true"
              />
            </div>
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
          <div className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-background-card text-foreground-muted shadow-sm">
            <Lock className="size-3" aria-hidden="true" />
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-sm font-bold",
              isLocked ? "text-foreground-muted" : "text-current",
            )}
          >
            {description}
          </p>
          {reward.kind === "points" ? (
            <div
              className={cn(
                "shrink-0 flex items-center gap-1.5 text-sm font-bold",
                isLocked ? "text-foreground-secondary" : "text-white",
              )}
            >
              <span>{reward.amount}</span>
              <ScoreIcon size={18} className="h-[1.05rem] w-auto" />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <div
            className={cn(
              "flex items-center justify-between text-xs font-semibold",
              isLocked ? "text-foreground-secondary" : "text-white/90",
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
              !isLocked && "[&>div]:bg-white bg-white/30",
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
