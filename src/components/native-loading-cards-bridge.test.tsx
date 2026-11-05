import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeLoadingCardsBridge } from "@/components/native-loading-cards-bridge";

const mocks = vi.hoisted(() => ({
  locale: "en",
  user: null as { id: string; profile: { preferredLanguageCode: string | null } } | null,
  isSessionReady: false,
  inventoryState: {
    cards: [] as unknown[],
    hydrated: false,
    cloudEnabled: false,
    cloudLoading: false,
    cloudLoadComplete: true,
    cloudError: "",
    ownerUserId: null as string | null,
  },
  setCards: vi.fn(),
  setEssentialDataReady: vi.fn(),
  deckCards: [] as unknown[],
  getOrCreateDailyCards: vi.fn((_: unknown, selectDeckCards: () => unknown[]) => selectDeckCards()),
  readDailyCards: vi.fn((..._args: unknown[]): unknown[] | null => null),
}));

vi.mock("@/i18n/locale-provider", () => ({
  useLocale: () => ({ locale: mocks.locale }),
}));
vi.mock("@/app/components/landing-card-language", () => ({
  readLandingCardLanguage: () => null,
  subscribeLandingCardLanguageSync: () => () => undefined,
}));
vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: () => ({ user: mocks.user, isSessionReady: mocks.isSessionReady }),
}));
vi.mock("@/features/inventory/native-loading-cards", () => ({
  completeNativeLoadingCards: (cards: unknown[]) => cards,
  getNativeLoadingDateKey: () => "2026-11-05",
  selectNativeLoadingDeckCards: () => mocks.deckCards,
  selectNativeLoadingOfflineDeckCards: () => [],
}));
vi.mock("@/features/inventory/native-loading-daily-cache", () => ({
  getOrCreateNativeLoadingDailyDeckCards: (identity: unknown, selectDeckCards: () => unknown[]) =>
    mocks.getOrCreateDailyCards(identity, selectDeckCards),
  readNativeLoadingDailyDeckCards: (...args: unknown[]) => mocks.readDailyCards(...args),
}));
vi.mock("@/features/inventory/offline-card-storage", () => ({
  listOfflineInventorySnapshot: vi.fn(async () => []),
}));
vi.mock("@/features/inventory/native-loading-copy", () => ({
  getNativeLoadingStatuses: () => [],
  getNativeLoadingTitle: () => "Words of the day",
}));
vi.mock("@/features/inventory/inventory-store", () => ({
  useInventoryStore: (selector: (state: typeof mocks.inventoryState) => unknown) => selector(mocks.inventoryState),
}));
vi.mock("@/lib/super-water", () => ({
  formatSuperWaterText: (_locale: string, value: string) => value,
  formatSuperWaterUppercaseText: (_locale: string, value: string) => value,
}));

describe("NativeLoadingCardsBridge", () => {
  beforeEach(() => {
    mocks.locale = "en";
    mocks.user = {
      id: "user-1",
      profile: { preferredLanguageCode: "en" },
    };
    mocks.isSessionReady = true;
    mocks.inventoryState = {
      cards: [],
      hydrated: true,
      cloudEnabled: true,
      cloudLoading: true,
      cloudLoadComplete: false,
      cloudError: "",
      ownerUserId: "user-1",
    };
    mocks.setCards.mockReset();
    mocks.setEssentialDataReady.mockReset();
    mocks.deckCards = [];
    mocks.getOrCreateDailyCards.mockClear().mockImplementation((_, selectDeckCards) => selectDeckCards());
    mocks.readDailyCards.mockReset().mockReturnValue(null);
    window.FoxiesDeckNativeLoading = {
      setCards: mocks.setCards,
      setEssentialDataReady: mocks.setEssentialDataReady,
    };
  });

  afterEach(() => {
    cleanup();
    delete window.FoxiesDeckNativeLoading;
  });

  it("keeps the native loader waiting until this user's cloud inventory settles", async () => {
    const view = render(<NativeLoadingCardsBridge />);

    await waitFor(() => expect(mocks.setCards).toHaveBeenCalled());
    expect(mocks.setEssentialDataReady).not.toHaveBeenCalled();

    mocks.inventoryState.cloudLoading = false;
    mocks.inventoryState.cloudLoadComplete = true;
    view.rerender(<NativeLoadingCardsBridge />);

    await waitFor(() => expect(mocks.setEssentialDataReady).toHaveBeenCalledOnce());
  });

  it("reuses cached deck cards before cloud data settles and marks readiness after the cloud attempt", async () => {
    const cachedCard = {
      sourceKey: "en:word:hello",
      term: "hello",
      translation: "merhaba",
      pronunciation: "heh-low",
      example: "Hello, my friend.",
      tier: "A1",
    };
    mocks.readDailyCards.mockReturnValue([cachedCard]);
    mocks.getOrCreateDailyCards.mockImplementation((_, selectDeckCards) =>
      mocks.readDailyCards() ?? selectDeckCards(),
    );

    const view = render(<NativeLoadingCardsBridge />);

    await waitFor(() => expect(mocks.setCards).toHaveBeenCalledWith(JSON.stringify([cachedCard])));
    expect(mocks.setEssentialDataReady).not.toHaveBeenCalled();

    mocks.inventoryState.cloudLoading = false;
    mocks.inventoryState.cloudLoadComplete = true;
    view.rerender(<NativeLoadingCardsBridge />);

    await waitFor(() => expect(mocks.setEssentialDataReady).toHaveBeenCalledOnce());
    expect(mocks.setCards).toHaveBeenLastCalledWith(JSON.stringify([cachedCard]));
  });

  it("creates the daily cache from the ready user's deck and sends that selection", async () => {
    const deckCard = {
      sourceKey: "en:word:hello",
      term: "hello",
      translation: "merhaba",
      pronunciation: "heh-low",
      example: "Hello, my friend.",
      tier: "A1",
    };
    mocks.deckCards = [deckCard];
    mocks.inventoryState.cloudLoading = false;
    mocks.inventoryState.cloudLoadComplete = true;

    render(<NativeLoadingCardsBridge />);

    await waitFor(() => expect(mocks.setEssentialDataReady).toHaveBeenCalledOnce());
    expect(mocks.getOrCreateDailyCards).toHaveBeenCalledWith(
      {
        profileId: "user-1",
        learningLanguage: "en",
        locale: "en",
        dateKey: "2026-11-05",
      },
      expect.any(Function),
    );
    expect(mocks.setCards).toHaveBeenLastCalledWith(JSON.stringify([deckCard]));
  });
});
