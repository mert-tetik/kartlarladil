import type { GameName } from "@/features/games/game-types";
import type { Tier } from "@/types/domain";

const GAME_LAUNCH_EVENT = "foxiesdeck:game-launch";
const GAME_LAUNCH_STORAGE_KEY = "foxiesdeck:pending-game-launch";
const GAME_LAUNCH_HANDLED_STORAGE_KEY = "foxiesdeck:handled-game-launch";
const GAME_LAUNCH_MAX_AGE_MS = 10_000;

export const GAME_LAUNCH_COLORS: Record<GameName, string> = {
  memory: "#168EFF",
  wordChallenge: "#6CD92F",
  wordMatch: "#FF7AB4",
};

export interface GameLaunchRequest {
  game: GameName;
  href: string;
  color: string;
  level?: number;
  tier?: Tier;
  origin: {
    x: number;
    y: number;
  };
}

interface StoredGameLaunch {
  game: GameName;
  createdAt: number;
}

export function requestGameLaunch(request: GameLaunchRequest) {
  if (typeof window === "undefined") return;

  try {
    const stored: StoredGameLaunch = {
      game: request.game,
      createdAt: Date.now(),
    };
    window.sessionStorage.setItem(GAME_LAUNCH_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // The transition can continue when session storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent<GameLaunchRequest>(GAME_LAUNCH_EVENT, { detail: request }));
}

export function subscribeToGameLaunch(listener: (request: GameLaunchRequest) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const request = (event as CustomEvent<GameLaunchRequest>).detail;
    if (request) listener(request);
  };

  window.addEventListener(GAME_LAUNCH_EVENT, handler);
  return () => window.removeEventListener(GAME_LAUNCH_EVENT, handler);
}

function readPendingGameLaunch(): StoredGameLaunch | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(GAME_LAUNCH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredGameLaunch;
  } catch {
    return null;
  }
}

export function hasPendingGameLaunch(game: GameName): boolean {
  const stored = readPendingGameLaunch();
  return stored?.game === game && Date.now() - stored.createdAt < GAME_LAUNCH_MAX_AGE_MS;
}

export function consumePendingGameLaunch(game: GameName): boolean {
  if (!hasPendingGameLaunch(game) || typeof window === "undefined") return false;

  try {
    window.sessionStorage.removeItem(GAME_LAUNCH_STORAGE_KEY);
  } catch {
    // The splash still plays when session storage cleanup is unavailable.
  }

  return true;
}

export function markGameLaunchHandled(game: GameName) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(GAME_LAUNCH_STORAGE_KEY);
    window.sessionStorage.setItem(
      GAME_LAUNCH_HANDLED_STORAGE_KEY,
      JSON.stringify({ game, createdAt: Date.now() } satisfies StoredGameLaunch),
    );
  } catch {
    // Navigation can still continue when session storage is unavailable.
  }
}

export function consumeHandledGameLaunch(game: GameName): boolean {
  if (typeof window === "undefined") return false;

  try {
    const raw = window.sessionStorage.getItem(GAME_LAUNCH_HANDLED_STORAGE_KEY);
    if (!raw) return false;

    const stored = JSON.parse(raw) as StoredGameLaunch;
    if (stored.game !== game || Date.now() - stored.createdAt >= GAME_LAUNCH_MAX_AGE_MS) {
      return false;
    }

    window.sessionStorage.removeItem(GAME_LAUNCH_HANDLED_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
