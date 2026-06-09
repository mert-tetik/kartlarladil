"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PackagePlus, Search } from "lucide-react";
import { localCardRepository } from "@/features/cards/card-repository";
import { FilterControls } from "@/features/cards/components/filter-controls";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import {
  DEFAULT_DISCOVER_PREFERENCES,
  DISCOVER_PREFERENCES_KEY,
  getDiscoverPreferenceFallback,
  normalizeDiscoverPreferences,
  subscribeDiscoverPreferences,
  writeDiscoverPreferences,
  type DiscoverLanguageFilter,
  type DiscoverTierFilter,
} from "@/features/cards/discover-preferences";
import { useAuthSession, useRequireAuthAction } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import type { VocabularyCard } from "@/types/domain";

type DiscoverDismissKind = "skip" | "add";

interface ExitingDiscoverCard {
  key: string;
  card: VocabularyCard;
  kind: DiscoverDismissKind;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

const DISCOVER_EXIT_ANIMATION_MS = 380;
const DISCOVER_LAYOUT_ANIMATION_MS = 360;

export function DiscoverWorkbench() {
  const { user } = useAuthSession();
  const profile = user?.profile ?? null;
  const profileFallback = useMemo(() => getDiscoverPreferenceFallback(profile), [profile]);
  const storedPreferenceSnapshot = useSyncExternalStore(
    subscribeDiscoverPreferences,
    () => window.localStorage.getItem(DISCOVER_PREFERENCES_KEY) ?? "",
    () => "",
  );
  const preferences = useMemo(
    () => parseStoredPreferences(storedPreferenceSnapshot, profileFallback),
    [profileFallback, storedPreferenceSnapshot],
  );
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<VocabularyCard[]>(() =>
    localCardRepository.draw(5, profileFallback),
  );
  const [dealCycle, setDealCycle] = useState(0);
  const [exitingCards, setExitingCards] = useState<ExitingDiscoverCard[]>([]);
  const [exitGridHeight, setExitGridHeight] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const layoutSnapshotRef = useRef(new Map<string, DOMRect>());
  const exitTimerRefs = useRef<number[]>([]);
  const exitSequenceRef = useRef(0);
  const skipNextOwnedRefreshRef = useRef(false);
  const inventoryCards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudError = useInventoryStore((state) => state.cloudError);
  const addCard = useInventoryStore((state) => state.addCard);
  const requireAuthAction = useRequireAuthAction();

  const ownedIds = useMemo(() => new Set(inventoryCards.map((card) => card.cardId)), [inventoryCards]);
  const { language, tier } = preferences;
  const showCardGrid = cards.length > 0 || exitingCards.length > 0;

  useEffect(() => {
    if (skipNextOwnedRefreshRef.current) {
      skipNextOwnedRefreshRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCards(localCardRepository.draw(5, preferences, [...ownedIds]));
      setDealCycle((cycle) => cycle + 1);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [ownedIds, preferences]);

  useEffect(() => {
    const exitTimers = exitTimerRefs.current;

    return () => {
      for (const timerId of exitTimers) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  useLayoutEffect(() => {
    // FLIP keeps the remaining cards moving from their old grid positions instead of jumping.
    const snapshot = layoutSnapshotRef.current;

    if (snapshot.size === 0 || shouldReduceMotion()) {
      layoutSnapshotRef.current = new Map();
      return;
    }

    for (const [cardId, element] of cardRefs.current) {
      const previousRect = snapshot.get(cardId);

      if (!previousRect || typeof element.animate !== "function") {
        continue;
      }

      const nextRect = element.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        continue;
      }

      element.animate(
        [
          { transform: `translate3d(${deltaX}px, ${deltaY}px, 0)` },
          { transform: "translate3d(0, 0, 0)" },
        ],
        {
          duration: DISCOVER_LAYOUT_ANIMATION_MS,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    }

    layoutSnapshotRef.current = new Map();
  }, [cards]);

  function dealCards(nextCards: VocabularyCard[]) {
    setExitingCards([]);
    setExitGridHeight(null);
    setCards(nextCards);
    setDealCycle((cycle) => cycle + 1);
  }

  function updatePreferences(nextPreferences: {
    language?: DiscoverLanguageFilter;
    tier?: DiscoverTierFilter;
  }) {
    const updatedPreferences = {
      language,
      tier,
      ...nextPreferences,
    };

    writeDiscoverPreferences(window.localStorage, updatedPreferences);
  }

  function searchCards() {
    dealCards(
      localCardRepository
        .list({ query, language, tier })
        .filter((card) => !ownedIds.has(card.id))
        .slice(0, 18),
    );
  }

  function drawCards(count: 5 | 10) {
    dealCards(localCardRepository.draw(count, { language, tier }, [...ownedIds]));
  }

  function skipCard(cardId: string) {
    dismissCard(cardId, "skip");
  }

  function addDiscoveredCard(cardId: string) {
    requireAuthAction(() => {
      skipNextOwnedRefreshRef.current = true;
      dismissCard(cardId, "add");
      void addCard(cardId);
    }, { nextPath: "/kesfet" });
  }

  function dismissCard(cardId: string, kind: DiscoverDismissKind) {
    const card = cards.find((item) => item.id === cardId);

    if (!card) {
      return;
    }

    captureLayoutSnapshot();
    const exitKey = `${kind}-${card.id}-${exitSequenceRef.current}`;
    exitSequenceRef.current += 1;
    const exitingCard = createExitingCard(card, kind, exitKey);

    if (exitingCard) {
      setExitingCards((current) => [...current, exitingCard]);
      const timerId = window.setTimeout(() => {
        setExitingCards((current) => current.filter((item) => item.key !== exitingCard.key));
      }, DISCOVER_EXIT_ANIMATION_MS);

      exitTimerRefs.current.push(timerId);
    }

    setCards((current) => current.filter((item) => item.id !== cardId));
  }

  function captureLayoutSnapshot() {
    const snapshot = new Map<string, DOMRect>();

    for (const [cardId, element] of cardRefs.current) {
      snapshot.set(cardId, element.getBoundingClientRect());
    }

    layoutSnapshotRef.current = snapshot;
  }

  function createExitingCard(card: VocabularyCard, kind: DiscoverDismissKind, exitKey: string) {
    const grid = gridRef.current;
    const element = cardRefs.current.get(card.id);

    if (!grid || !element) {
      return null;
    }

    const gridRect = grid.getBoundingClientRect();
    const cardRect = element.getBoundingClientRect();
    setExitGridHeight(grid.offsetHeight);

    return {
      key: exitKey,
      card,
      kind,
      rect: {
        left: cardRect.left - gridRect.left,
        top: cardRect.top - gridRect.top,
        width: cardRect.width,
        height: cardRect.height,
      },
    };
  }

  function setCardRef(cardId: string, element: HTMLDivElement | null) {
    if (element) {
      cardRefs.current.set(cardId, element);
      return;
    }

    cardRefs.current.delete(cardId);
  }

  if (!hydrated) {
    return <EmptyState icon={PackagePlus} title="Hazne hazırlanıyor" description="Kart koleksiyonun tarayıcıda açılıyor." />;
  }

  return (
    <div className="space-y-6">
      {cloudError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {cloudError}
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  searchCards();
                }
              }}
              placeholder="Kelime, çeviri veya örnek cümle ara"
              className="h-12 w-full rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-950"
            />
          </label>
          <Button variant="secondary" size="lg" onClick={() => drawCards(5)}>
            5 kart çek
          </Button>
          <Button size="lg" onClick={() => drawCards(10)}>
            10 kart çek
          </Button>
        </div>
        <div className="mt-4">
          <FilterControls
            language={language}
            tier={tier}
            onLanguageChange={(nextLanguage) => updatePreferences({ language: nextLanguage })}
            onTierChange={(nextTier) => updatePreferences({ tier: nextTier })}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={searchCards}>
            Ara
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              writeDiscoverPreferences(window.localStorage, DEFAULT_DISCOVER_PREFERENCES);
              if (language === DEFAULT_DISCOVER_PREFERENCES.language && tier === DEFAULT_DISCOVER_PREFERENCES.tier) {
                dealCards(localCardRepository.draw(5, DEFAULT_DISCOVER_PREFERENCES, [...ownedIds]));
              }
            }}
          >
            Filtreleri temizle
          </Button>
        </div>
      </div>

      {showCardGrid ? (
        <div
          ref={gridRef}
          className="discover-card-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          style={exitingCards.length > 0 && exitGridHeight ? { minHeight: `${exitGridHeight}px` } : undefined}
        >
          {cards.map((card, index) => (
            <div
              key={`${dealCycle}-${card.id}`}
              ref={(element) => setCardRef(card.id, element)}
              data-card-deal-index={index}
              className="discover-card-deal"
              style={{ animationDelay: `${index * 55}ms` }}
            >
              <VocabularyCardView
                card={card}
                owned={ownedIds.has(card.id)}
                initialFace="back"
                flippable
                onAdd={() => addDiscoveredCard(card.id)}
                onSkip={() => skipCard(card.id)}
              />
            </div>
          ))}
          {exitingCards.map((item) => (
            <div
              key={item.key}
              data-discover-exit-kind={item.kind}
              className="discover-card-exit"
              style={{
                left: `${item.rect.left}px`,
                top: `${item.rect.top}px`,
                width: `${item.rect.width}px`,
                height: `${item.rect.height}px`,
              }}
            >
              <VocabularyCardView
                card={item.card}
                owned={item.kind === "add"}
                initialFace="front"
                onAdd={() => undefined}
                onSkip={() => undefined}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={PackagePlus}
          title="Bu filtrede yeni kart kalmadı"
          description="Başka bir dil veya tier seçerek yeni kartlar çekebilirsin."
        />
      )}
    </div>
  );
}

function parseStoredPreferences(snapshot: string, fallback: typeof DEFAULT_DISCOVER_PREFERENCES) {
  if (!snapshot) {
    return fallback;
  }

  try {
    return normalizeDiscoverPreferences(JSON.parse(snapshot), fallback);
  } catch {
    return fallback;
  }
}

function shouldReduceMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
