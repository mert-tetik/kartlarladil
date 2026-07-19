import {
  consumePendingGameLaunch,
  hasPendingGameLaunch,
  requestGameLaunch,
  subscribeToGameLaunch,
} from "./game-launch-transition";

describe("game launch transition", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("persists a pending launch for the matching game", () => {
    requestGameLaunch({
      game: "memory",
      href: "/games/memory",
      color: "#ef4444",
      origin: { x: 120, y: 280 },
    });

    expect(hasPendingGameLaunch("memory")).toBe(true);
    expect(hasPendingGameLaunch("wordMatch")).toBe(false);
    expect(consumePendingGameLaunch("memory")).toBe(true);
    expect(hasPendingGameLaunch("memory")).toBe(false);
  });

  it("notifies the global cover about a launch request", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToGameLaunch(listener);

    requestGameLaunch({
      game: "wordChallenge",
      href: "/games/word-challenge",
      color: "#10b981",
      origin: { x: 32, y: 64 },
    });

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      game: "wordChallenge",
      href: "/games/word-challenge",
    }));

    unsubscribe();
  });
});
