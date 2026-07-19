import type { GameName } from "@/features/games/game-types";

const GAME_LAUNCH_EVENT = "foxiesdeck:game-launch";
const GAME_LAUNCH_STORAGE_KEY = "foxiesdeck:pending-game-launch";
const GAME_LAUNCH_MAX_AGE_MS = 10_000;

export const GAME_LAUNCH_COLORS: Record<GameName, string> = {
  memory: "#ef4444",
  wordChallenge: "#10b981",
  wordMatch: "#38bdf8",
};

export interface GameLaunchRequest {
  game: GameName;
  href: string;
  color: string;
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
