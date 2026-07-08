"use client";

import { Gift, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import { AI_PRACTICE_CHARACTERS } from "@/features/ai-practice/ai-practice-data";
import { getChestLabelKey } from "@/features/quiz/chest-rewards";
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
  onClaim: () => void;
  claiming: boolean;
  disabled?: boolean;
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
  disabled = false,
}: MissionCardProps) {
  const t = useT();
  const { locale } = useLocale();
  const progressPercent = Math.min(100, Math.round((progress / requirement) * 100));
  const isWaiting = status === "waiting";
  const isClaimed = status === "claimed";
  const isLocked = status === "locked";

  const rewardLabel =
    reward.kind === "chest"
      ? t("missions.reward.chest", { tier: t(getChestLabelKey(reward.tier)) })
      : t("missions.reward.points", { count: reward.amount });

  const description = getMissionDescription(t, type, requirement, locale, game, characterId);

  return (
    <div
      data-mission-card={missionId}
      data-mission-status={status}
      className={cn(
        "relative flex items-center gap-4 rounded-2xl border border-border bg-background-card p-4 shadow-sm transition-all",
        isLocked && "opacity-70",
        isWaiting && "border-emerald-500/40 bg-emerald-500/5",
      )}
    >
      <div
        className={cn(
          "relative flex size-14 shrink-0 items-center justify-center rounded-xl border-2 transition-colors",
          isLocked
            ? "border-border bg-background-muted text-foreground-muted"
            : "border-amber-400/40 bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md",
        )}
      >
        {reward.kind === "chest" ? (
          <ChestIcon tier={reward.tier} className={cn(isLocked && "opacity-60")} />
        ) : (
          <Gift className={cn("size-7", isLocked && "opacity-50")} aria-hidden="true" />
        )}
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
              isLocked ? "text-foreground-muted" : "text-foreground",
            )}
          >
            {description}
          </p>
          <span
            className={cn(
              "shrink-0 text-xs font-bold",
              reward.kind === "chest" ? "text-amber-500" : "text-emerald-500",
            )}
          >
            {rewardLabel}
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground-secondary">
            <span>
              {progress}/{requirement}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <Progress
            value={progressPercent}
            className="h-2"
            aria-label={t("missions.progressLabel", { progress, requirement })}
          />
        </div>
      </div>

      <Button
        size="sm"
        disabled={!isWaiting || claiming || disabled}
        onClick={() => {
          vibrate("tap");
          onClaim();
        }}
        className={cn(
          "h-11 w-24 shrink-0 rounded-xl font-bold transition-all",
          isWaiting
            ? "animate-mission-claim-pulse bg-emerald-500 text-white hover:bg-emerald-600"
            : isClaimed
              ? "bg-emerald-700/30 text-emerald-700 hover:bg-emerald-700/40"
              : "bg-background-muted text-foreground-muted",
        )}
      >
        {claiming ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : isWaiting ? (
          t("missions.claim")
        ) : isClaimed ? (
          t("missions.claimed")
        ) : (
          t("missions.locked")
        )}
      </Button>
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
