"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Search } from "lucide-react";
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
import { UpgradeDialog, type UpgradeDialogErrorCode } from "@/features/subscriptions/components/upgrade-dialog";
import { PLAN_LIMITS } from "@/features/subscriptions/subscription-limits";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useLocale, useT } from "@/i18n/locale-provider";
import { useVisualViewport } from "@/lib/use-visual-viewport";
import { cn, normalizeSearch } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import type { VocabularyCard } from "@/types/domain";

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
  const [limitError, setLimitError] = useState<UpgradeDialogErrorCode | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [rawHighlightedIndex, setRawHighlightedIndex] = useState(-1);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const suggestionRefs = useRef<(HTMLButtonElement | null)[]>([]);
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
  useVisualViewport();

  const ownedIds = useMemo(() => new Set(inventoryCards.map((card) => card.cardId)), [inventoryCards]);
  const inventoryById = useMemo(
    () => new Map(inventoryCards.map((card) => [card.cardId, card] as const)),
    [inventoryCards],
  );
  const { language, tier } = preferences;
  const showCardGrid = cards.length > 0 || exitingCards.length > 0;

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const normalizedQuery = normalizeSearch(query);
    const candidates = localCardRepository.list({ query, language, tier: "all" });

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
  }, [query, language, locale]);

  const highlightedIndex = rawHighlightedIndex >= 0 && rawHighlightedIndex < suggestions.length ? rawHighlightedIndex : -1;

  const prevOwnedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const ownedIdsChanged = !setsAreEqual(prevOwnedIdsRef.current, ownedIds);
    if (ownedIdsChanged) {
      prevOwnedIdsRef.current = new Set(ownedIds);
      setCards((current) => current.filter((card) => !ownedIds.has(card.id)));
    }
  }, [ownedIds]);

  useEffect(() => {
    const exitTimers = exitTimerRefs.current;

    return () => {
      for (const timerId of exitTimers) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1023px)");

    function updateMobileSearchLayout() {
      const mobile = mediaQuery.matches;
      setIsMobileViewport(mobile);

      if (!mobile) {
        setIsDropdownOpen(false);
      }
    }

    updateMobileSearchLayout();
    mediaQuery.addEventListener("change", updateMobileSearchLayout);
    window.addEventListener("resize", updateMobileSearchLayout);

    return () => {
      mediaQuery.removeEventListener("change", updateMobileSearchLayout);
      window.removeEventListener("resize", updateMobileSearchLayout);
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
    setRawHighlightedIndex(-1);
    vibrate("draw");
    dealCards([card]);
  }

  function handleSuggestionKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!isDropdownOpen) {
      if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length > 0) {
        event.preventDefault();
        setIsDropdownOpen(true);
        setRawHighlightedIndex(0);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsDropdownOpen(false);
      setRawHighlightedIndex(-1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setRawHighlightedIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setRawHighlightedIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const index = highlightedIndex >= 0 ? highlightedIndex : 0;
      const card = suggestions[index];
      if (card) {
        selectSuggestion(card);
      }
    }
  }

  useEffect(() => {
    const element = suggestionRefs.current[highlightedIndex];
    if (element && typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  function updateSearchQuery(nextQuery: string) {
    setQuery(nextQuery);
    setIsDropdownOpen(true);
    setRawHighlightedIndex(-1);
  }

  function drawCards(count: number) {
    vibrate("draw");
    dealCards(localCardRepository.draw(count, { language, tier }, [...ownedIds]));
  }

  function skipCard(cardId: string) {
    dismissCard(cardId, "skip");
  }

  function addDrawnCard(cardId: string) {
    requireAuthAction(() => {
      const existingCard = inventoryById.get(cardId);

      if (existingCard) {
        setLimitError(existingCard.status === "learned" ? "inventory_card_already_learned" : "inventory_card_already_active");
        return;
      }

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
        title={t("cards.poolPreparingTitle")}
        description={t("cards.poolPreparingDescription")}
      />
    );
  }

  return (
    <div
      className="max-lg:relative max-lg:flex max-lg:h-full max-lg:min-h-0 max-lg:flex-col max-lg:bg-background"
      data-card-draw-workbench
    >
      {/* Controls - attached to bottom on mobile, normal card on desktop */}
      <div
        className="max-lg:absolute max-lg:bottom-[var(--keyboard-height,0px)] max-lg:left-0 max-lg:right-0 max-lg:z-30 max-lg:border-t max-lg:border-border max-lg:bg-background-card max-lg:p-2 lg:rounded-lg lg:border lg:border-border lg:bg-background-card lg:p-4"
        data-card-draw-controls
      >
        <div className="mx-auto max-w-7xl space-y-3 max-lg:space-y-1">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <div ref={dropdownRef} className="relative max-lg:min-h-11">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-foreground-muted" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => {
                    updateSearchQuery(event.target.value);
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0 || query.trim()) {
                      setIsDropdownOpen(true);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (isMobileViewport && event.key === "Escape") {
                      event.preventDefault();
                      setIsDropdownOpen(false);
                      setRawHighlightedIndex(-1);
                      return;
                    }

                    handleSuggestionKeyDown(event);
                  }}
                  placeholder={t("cards.searchPlaceholder")}
                  className="relative h-12 w-full rounded-md border border-border bg-background-card pl-10 pr-4 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-foreground-muted focus:border-foreground max-lg:h-11"
                  data-card-draw-search-input
                />
              </div>

              {isDropdownOpen ? (
                <div className="animate-menu-pop origin-top absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-background-card py-1 shadow-lg max-lg:bottom-full max-lg:mb-1 max-lg:mt-0">
                  {suggestions.length > 0 ? (
                    suggestions.map((card, index) => {
                      const style = TIER_STYLES[card.tier];
                      const highlighted = index === highlightedIndex;
                      return (
                        <button
                          key={card.id}
                          ref={(element) => {
                            suggestionRefs.current[index] = element;
                          }}
                          type="button"
                          onClick={() => selectSuggestion(card)}
                          onMouseEnter={() => setRawHighlightedIndex(index)}
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm outline-none",
                            highlighted ? "bg-background-muted" : "hover:bg-background-muted",
                          )}
                        >
                          <span className="font-semibold text-foreground">{card.term}</span>
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold text-foreground-inverse ${style.accent}`}>
                            {card.tier}
                          </span>
                        </button>
                      );
                    })
                  ) : query.trim() ? (
                    <div className="px-3 py-2.5 text-sm text-foreground-muted">{t("cards.noSearchResults")}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div
              className="grid grid-cols-2 gap-3 lg:contents"
              data-card-draw-draw-actions
            >
              <Button
                size="lg"
                onClick={() => drawCards(5)}
                className="border-0 bg-brand text-brand-foreground hover:bg-brand-hover focus-visible:outline-brand"
              >
                {t("cards.drawFive")}
              </Button>
              <Button size="lg" onClick={() => drawCards(10)}>
                {t("cards.drawTen")}
              </Button>
            </div>
          </div>
          <div data-card-draw-filters>
            <FilterControls
              language={language}
              tier={tier}
              onLanguageChange={(nextLanguage) => updatePreferences({ language: nextLanguage })}
              onTierChange={(nextTier) => updatePreferences({ tier: nextTier })}
              mobileMenuDirection="up"
            />
          </div>
        </div>
      </div>

      {/* Cards area - fills the space above controls on mobile */}
      <div
        className="max-lg:order-1 max-lg:flex-1 max-lg:min-h-0 max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:pb-48 max-lg:touch-pan-y lg:mt-6"
        data-card-draw-scroll-area
      >
        <div className="mx-auto flex h-full max-w-7xl flex-col max-lg:px-4 max-lg:py-4 lg:px-0">
          {cloudError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              {cloudError}
            </div>
          ) : null}

          <div className="max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col">
            {showCardGrid ? (
              <div
                ref={gridRef}
                className="card-draw-card-grid grid min-h-0 grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4"
                style={{
                  ...(exitingCards.length > 0 && exitGridHeight ? { minHeight: `${exitGridHeight}px` } : {}),
                }}
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
                      inventory={inventoryById.get(card.id)}
                      owned={ownedIds.has(card.id)}
                      allowOwnedAdd
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
                  mascot="/mascots/mascot17.png"
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
