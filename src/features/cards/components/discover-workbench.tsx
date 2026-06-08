"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
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
  const inventoryCards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const addCard = useInventoryStore((state) => state.addCard);
  const requireAuthAction = useRequireAuthAction();

  const ownedIds = useMemo(() => new Set(inventoryCards.map((card) => card.cardId)), [inventoryCards]);
  const { language, tier } = preferences;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCards(localCardRepository.draw(5, preferences, [...ownedIds]));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [ownedIds, preferences]);

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
    setCards(localCardRepository.draw(5, updatedPreferences, [...ownedIds]));
  }

  function searchCards() {
    setCards(
      localCardRepository
        .list({ query, language, tier })
        .filter((card) => !ownedIds.has(card.id))
        .slice(0, 18),
    );
  }

  function drawCards(count: 5 | 10) {
    setCards(localCardRepository.draw(count, { language, tier }, [...ownedIds]));
  }

  function skipCard(cardId: string) {
    setCards((current) => current.filter((card) => card.id !== cardId));
  }

  if (!hydrated) {
    return <EmptyState icon={PackagePlus} title="Hazne hazırlanıyor" description="Kart koleksiyonun tarayıcıda açılıyor." />;
  }

  return (
    <div className="space-y-6">
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
              setCards(localCardRepository.draw(5, DEFAULT_DISCOVER_PREFERENCES, [...ownedIds]));
            }}
          >
            Filtreleri temizle
          </Button>
        </div>
      </div>

      {cards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card) => (
            <VocabularyCardView
              key={card.id}
              card={card}
              owned={ownedIds.has(card.id)}
              onAdd={() => requireAuthAction(() => addCard(card.id), { nextPath: "/kesfet" })}
              onSkip={() => skipCard(card.id)}
            />
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
