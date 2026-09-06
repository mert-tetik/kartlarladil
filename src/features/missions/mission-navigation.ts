import { TIERS } from "@/data/tiers";
import type { GameName } from "@/features/games/game-types";
import type { LanguageCode, Tier } from "@/types/domain";
import type { MissionDefinition } from "./mission-types";

export const LANDING_MISSION_ACTION_QUERY_KEY = "mission-action";
export const MISSION_ACTION_LANGUAGE_QUERY_KEY = "language";
export const MISSION_GAME_QUERY_KEY = "mission-game";
export const MISSION_AUTO_START_QUERY_KEY = "mission-auto-start";

export type LandingMissionAction = "draw-cards" | "start-learning";

export type MissionNavigationTarget =
  | {
      kind: "landing-action";
      action: LandingMissionAction;
      language: LanguageCode;
      fallbackHref: string;
    }
  | {
      kind: "route";
      href: string;
    };

const GAME_NAMES: readonly GameName[] = ["memory", "wordChallenge", "wordMatch"];

export function selectRandomPracticeTier(randomValue = Math.random()): Tier {
  const normalized = Number.isFinite(randomValue) ? Math.min(0.999999, Math.max(0, randomValue)) : 0;
  return TIERS[Math.floor(normalized * TIERS.length)] ?? "A1";
}

export function resolveMissionNavigation(
  mission: Pick<MissionDefinition, "type" | "game" | "characterId">,
  preferredLanguage: LanguageCode,
  randomValue = Math.random(),
): MissionNavigationTarget | null {
  switch (mission.type) {
    case "add_cards":
      return {
        kind: "landing-action",
        action: "draw-cards",
        language: preferredLanguage,
        fallbackHref: "/card-draw",
      };
    case "learn_cards":
      return {
        kind: "landing-action",
        action: "start-learning",
        language: preferredLanguage,
        fallbackHref: `/learn?mode=active&language=${encodeURIComponent(preferredLanguage)}`,
      };
    case "game_level": {
      const game = mission.game ?? "memory";
      return {
        kind: "route",
        href: `/games?${MISSION_GAME_QUERY_KEY}=${encodeURIComponent(game)}&${MISSION_AUTO_START_QUERY_KEY}=1`,
      };
    }
    case "ai_practice":
      if (!mission.characterId) return null;

      return {
        kind: "route",
        href: `/ai-practice/${encodeURIComponent(preferredLanguage)}/${encodeURIComponent(mission.characterId)}?tier=${selectRandomPracticeTier(randomValue)}`,
      };
    default:
      return null;
  }
}

export function getMissionNavigationHref(target: MissionNavigationTarget, isMobile: boolean) {
  if (target.kind === "landing-action") {
    if (!isMobile) return target.fallbackHref;

    return `/?${LANDING_MISSION_ACTION_QUERY_KEY}=${encodeURIComponent(target.action)}&${MISSION_ACTION_LANGUAGE_QUERY_KEY}=${encodeURIComponent(target.language)}`;
  }

  return target.href;
}

export function parseLandingMissionAction(value: string | null): LandingMissionAction | null {
  return value === "draw-cards" || value === "start-learning" ? value : null;
}

export function parseMissionGame(value: string | null): GameName | null {
  if (!value) return null;
  return GAME_NAMES.includes(value as GameName) ? (value as GameName) : null;
}
