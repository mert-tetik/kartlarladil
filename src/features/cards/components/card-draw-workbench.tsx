"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { PackagePlus, Search } from "lucide-react";
import { TIER_STYLES } from "@/data/tiers";
import { localCardRepository } from "@/features/cards/card-repository";
import { getSearchableCardText } from "@/features/cards/card-localization";
import { FilterControls } from "@/features/cards/components/filter-controls";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import {
  CARD_DRAW_PREFERENCES_KEY,
  getCardDrawPreferenceFallback,
  normalizeCardDrawPreferences,
  subscribeCardDrawPreferences,
  writeCardDrawPreferences,
  type CardDrawLanguageFilter,
  type CardDrawPreferences,
  type CardDrawTierFilter,
} from "@/features/cards/card-draw-preferences";
import { useAuthSession, useRequireAuthAction } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useLocale, useT } from "@/i18n/locale-provider";
import { normalizeSearch } from "@/lib/utils";
import type { LimitErrorCode, VocabularyCard } from "@/types/domain";

type CardDrawDismissKind = "skip" | "add";

interface ExitingCardDrawCard {
  key: string;
  card: VocabularyCard;
  kind: CardDrawDismissKind;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

const CARD_DRAW_EXIT_ANIMATION_MS = 380;
const CARD_DRAW_LAYOUT_ANIMATION_MS = 360;

export function CardDrawWorkbench() {
  const { user } = useAuthSession();
  const profile = user?.profile ?? null;
  const profileFallback = useMemo(() => getCardDrawPreferenceFallback(profile), [profile]);
  const storedPreferenceSnapshot = useSyncExternalStore(
    subscribeCardDrawPreferences,
    () => window.localStorage.getItem(CARD_DRAW_PREFERENCES_KEY) ?? "",
    () => "",
  );
  const preferences = useMemo(
    () => parseStoredPreferences(storedPreferenceSnapshot, profileFallback),
    [profileFallback, storedPreferenceSnapshot],
  );
  const [query, setQuery] = useState("");
  const [cards, setCards] = useState<VocabularyCard[]>([]);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [dealCycle, setDealCycle] = useState(0);
  const [exitingCards, setExitingCards] = useState<ExitingCardDrawCard[]>([]);
  const [exitGridHeight, setExitGridHeight] = useState<number | null>(null);
  const [limitError, setLimitError] = useState<LimitErrorCode | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const layoutSnapshotRef = useRef(new Map<string, DOMRect>());
  const exitTimerRefs = useRef<number[]>([]);
  const exitSequenceRef = useRef(0);

  const inventoryCards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudError = useInventoryStore((state) => state.cloudError);
  const addCard = useInventoryStore((state) => state.addCard);
  const requireAuthAction = useRequireAuthAction();
  const { entitlements } = useSubscription();
  const { locale } = useLocale();
  const t = useT();

  const ownedIds = useMemo(() => new Set(inventoryCards.map((card) => card.cardId)), [inventoryCards]);
  const { language, tier } = preferences;
  const showCardGrid = cards.length > 0 || exitingCards.length > 0;

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const normalizedQuery = normalizeSearch(query);
    const candidates = localCardRepository
      .list({ query, language, tier })
      .filter((card) => !ownedIds.has(card.id));

    const scored = candidates.map((card) => {
      const normalizedTerm = normalizeSearch(card.term);
      let score = 0;
      if (normalizedTerm.startsWith(normalizedQuery)) {
        score += 100;
      } else if (normalizedTerm.includes(normalizedQuery)) {
        score += 80;
      } else {
        const text = normalizeSearch(getSearchableCardText(card, locale));
        if (text.startsWith(normalizedQuery)) {
          score += 60;
        } else if (text.includes(normalizedQuery)) {
          score += 40;
        }
      }
      return { card, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5).map((item) => item.card);
  }, [query, language, tier, ownedIds, locale]);

  const isFirstRenderRef = useRef(true);
  const prevOwnedIdsRef = useRef<Set<string>>(new Set());
  const prevPreferencesRef = useRef(preferences);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    const preferencesChanged =
      prevPreferencesRef.current.language !== preferences.language ||
      prevPreferencesRef.current.tier !== preferences.tier;

    if (preferencesChanged) {
      prevPreferencesRef.current = preferences;
      prevOwnedIdsRef.current = new Set(ownedIds);
      setCards([]);
      setHasDrawn(false);
      return;
    }

    const ownedIdsChanged = !setsAreEqual(prevOwnedIdsRef.current, ownedIds);
    if (ownedIdsChanged) {
      prevOwnedIdsRef.current = new Set(ownedIds);
      setCards((current) => current.filter((card) => !ownedIds.has(card.id)));
    }
  }, [ownedIds, preferences]);

  useEffect(() => {
    const exitTimers = exitTimerRefs.current;

    return () => {
      for (const timerId of exitTimers) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
          duration: CARD_DRAW_LAYOUT_ANIMATION_MS,
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
    setHasDrawn(true);
    setDealCycle((cycle) => cycle + 1);
  }

  function updatePreferences(nextPreferences: {
    language?: CardDrawLanguageFilter;
    tier?: CardDrawTierFilter;
  }) {
    const updatedPreferences = {
      language,
      tier,
      ...nextPreferences,
    };

    writeCardDrawPreferences(window.localStorage, updatedPreferences);
  }

  function selectSuggestion(card: VocabularyCard) {
    setQuery("");
    setIsDropdownOpen(false);
    dealCards([card]);
  }

  function drawCards(count: number) {
    dealCards(localCardRepository.draw(count, { language, tier }, [...ownedIds]));
  }

  function skipCard(cardId: string) {
    dismissCard(cardId, "skip");
  }

  function addDrawnCard(cardId: string) {
    requireAuthAction(() => {
      const effectivePlan = entitlements?.effectivePlan ?? "free";
      const activeLimit = PLAN_LIMITS[effectivePlan].activeCards;

      if (effectivePlan === "free" && typeof activeLimit === "number") {
        const activeCount = inventoryCards.filter((card) => card.status === "active").length;

        if (activeCount >= activeLimit) {
          setLimitError("free_active_card_limit");
          return;
        }
      }

      dismissCard(cardId, "add");
      void addCard(cardId);
    }, { nextPath: "/card-draw" });
  }

  function dismissCard(cardId: string, kind: CardDrawDismissKind) {
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
      }, CARD_DRAW_EXIT_ANIMATION_MS);

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

  function createExitingCard(card: VocabularyCard, kind: CardDrawDismissKind, exitKey: string) {
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
    return (
      <EmptyState
        icon={PackagePlus}
        title={t("cards.poolPreparingTitle")}
        description={t("cards.poolPreparingDescription")}
      />
    );
  }

  return (
    <div
      className="max-lg:-mb-24 max-lg:flex max-lg:h-[calc(100dvh-8rem)] max-lg:flex-col max-lg:bg-slate-50"
      data-card-draw-workbench
    >
      {/* Controls - attached to bottom on mobile, normal card on desktop */}
      <div className="max-lg:order-2 max-lg:shrink-0 max-lg:border-t max-lg:border-slate-200 max-lg:bg-white max-lg:p-2 lg:rounded-lg lg:border lg:border-slate-200 lg:bg-white lg:p-4">
        <div className="mx-auto max-w-7xl max-lg:space-y-1 space-y-3">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setIsDropdownOpen(true);
                }}
                placeholder={t("cards.searchPlaceholder")}
                className="relative h-12 max-lg:h-11 w-full rounded-md border border-slate-200 bg-white pl-10 pr-4 text-sm font-semibold text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-950"
              />
              {isDropdownOpen ? (
                <div
                  ref={dropdownRef}
                  className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg max-lg:bottom-full max-lg:mb-1 max-lg:mt-0"
                >
                  {suggestions.length > 0 ? (
                    suggestions.map((card) => {
                      const style = TIER_STYLES[card.tier];
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => selectSuggestion(card)}
                          className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-slate-100 focus:bg-slate-100 focus:outline-none"
                        >
                          <span className="font-semibold text-slate-950">{card.term}</span>
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold text-white ${style.accent}`}>
                            {card.tier}
                          </span>
                        </button>
                      );
                    })
                  ) : query.trim() ? (
                    <div className="px-3 py-2.5 text-sm text-slate-500">{t("cards.noSearchResults")}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 lg:contents">
              <Button
                size="lg"
                onClick={() => drawCards(5)}
                className="border-0 bg-[#f76808] text-white hover:bg-[#e05d00] focus-visible:outline-[#f76808]"
              >
                {t("cards.drawFive")}
              </Button>
              <Button size="lg" onClick={() => drawCards(10)}>
                {t("cards.drawTen")}
              </Button>
            </div>
          </div>
          <FilterControls
            language={language}
            tier={tier}
            onLanguageChange={(nextLanguage) => updatePreferences({ language: nextLanguage })}
            onTierChange={(nextTier) => updatePreferences({ tier: nextTier })}
          />
        </div>
      </div>

      {/* Cards area - fills the space above controls on mobile */}
      <div className="max-lg:order-1 max-lg:flex-1 max-lg:min-h-0 max-lg:overflow-y-auto">
        <div className="mx-auto flex h-full max-w-7xl flex-col max-lg:px-4 max-lg:py-4 lg:px-0">
          {cloudError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              {cloudError}
            </div>
          ) : null}

          <div className="max-lg:flex max-lg:flex-1 max-lg:flex-col">
            {showCardGrid ? (
              <div
                ref={gridRef}
                className="card-draw-card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                style={exitingCards.length > 0 && exitGridHeight ? { minHeight: `${exitGridHeight}px` } : undefined}
              >
                {cards.map((card, index) => (
                  <div
                    key={`${dealCycle}-${card.id}`}
                    ref={(element) => setCardRef(card.id, element)}
                    data-card-deal-index={index}
                    className="card-draw-card-deal"
                    style={{ animationDelay: `${index * 55}ms` }}
                  >
                    <VocabularyCardView
                      card={card}
                      owned={ownedIds.has(card.id)}
                      initialFace="back"
                      flippable
                      onAdd={() => addDrawnCard(card.id)}
                      onSkip={() => skipCard(card.id)}
                    />
                  </div>
                ))}
                {exitingCards.map((item) => (
                  <div
                    key={item.key}
                    data-card-draw-exit-kind={item.kind}
                    className="card-draw-card-exit"
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
              <div className="max-lg:flex max-lg:flex-1 max-lg:items-center max-lg:justify-center">
                <EmptyState
                  icon={PackagePlus}
                  title={hasDrawn ? t("cards.emptyDrawTitle") : t("cards.drawPromptTitle")}
                  description={hasDrawn ? t("cards.emptyDrawDescription") : t("cards.drawPromptDescription")}
                />
              </div>
            )}
          </div>

          <UpgradeDialog
            open={limitError !== null}
            errorCode={limitError}
            onOpenChange={(open) => {
              if (!open) {
                setLimitError(null);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function parseStoredPreferences(snapshot: string, fallback: CardDrawPreferences) {
  if (!snapshot) {
    return fallback;
  }

  try {
    return normalizeCardDrawPreferences(JSON.parse(snapshot), fallback);
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

function setsAreEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}
