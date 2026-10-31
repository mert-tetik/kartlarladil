"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Clock3, LoaderCircle, Plus, X } from "lucide-react";
import { useAppMessage } from "@/components/app-message-provider";
import { LanguageFlag } from "@/components/language-flag";
import { Button } from "@/components/ui/button";
import { LANGUAGES } from "@/data/languages";
import { useAuthSession } from "@/features/auth/auth-client";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { generatedCardSchema, type GeneratedCardResponse } from "@/features/cards/create-card-schema";
import { getCardDesignTierPalette } from "@/features/cards/card-design-tier-palette";
import { createDeckCardTermIndex, getDraftsNotInDeck, getGeneratedCardTermKey } from "@/features/inventory/offline-notes-card-match";
import { InventoryActionError, useInventoryStore } from "@/features/inventory/inventory-store";
import {
  listOfflineGeneratedDrafts,
  listOfflineSavedNotes,
  removeOfflineGeneratedDraft,
  removeOfflineSavedNote,
  saveOfflineGeneratedDraft,
  type OfflineGeneratedCardDraft,
  type OfflineGeneratedCardDraftEntry,
  type OfflineSavedNote,
  type OfflineSavedNoteEntry,
} from "@/features/inventory/offline-card-storage";
import { createOfflineNotesVisualTestNotes } from "@/features/inventory/offline-notes-visual-test-fixtures";
import { useLocale } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import { UpgradeDialog } from "@/features/subscriptions/components/upgrade-dialog";

const OVERLAY_ANIMATION_MS = 360;
const OFFLINE_PATHS = new Set(["/offline", "/~offline"]);
const EMPTY_TERM_INDEX: ReadonlySet<string> = new Set();

type OverlayPhase = "closed" | "opening" | "open" | "closing";
type NoteEntry = OfflineSavedNoteEntry & { note: OfflineSavedNote };
type DraftEntry = OfflineGeneratedCardDraftEntry & { draft: OfflineGeneratedCardDraft };

/* Test-only generated-card fixtures were removed: visual test mode now runs the
   same API conversion path as production and only injects saved notes. */
/*
function createLocalizedFixtureRecord(
  english: string,
  turkish: string,
  scriptOverrides: Partial<Record<LocaleCode, string>> = {},
): Record<LocaleCode, string> {
  return Object.fromEntries(
    LOCALE_CODES.map((code) => [code, code === "tr" ? turkish : scriptOverrides[code] ?? english]),
  ) as Record<LocaleCode, string>;
}

const VISUAL_TEST_GENERATED_CARDS: Partial<Record<LanguageCode, OfflineGeneratedCardDraft["generated"]>> = {
  en: {
    language: "en",
    tier: "B1",
    termKind: "word",
    term: "serendipity",
    partOfSpeech: "noun",
    pronunciation: "se-ren-di-pi-ti",
    translations: createLocalizedFixtureRecord("a fortunate discovery", "rastlantı sonucu bulunan güzel şey", {
      ru: "удачная находка", ar: "اكتشاف محظوظ", ja: "思いがけない幸運な発見", ko: "뜻밖의 행운의 발견", "zh-CN": "意外的幸运发现",
    }),
    definitions: createLocalizedFixtureRecord("Finding something valuable by chance.", "Şans eseri değerli bir şey bulma.", {
      ru: "Найти что-то ценное случайно.", ar: "العثور على شيء ذي قيمة بالمصادفة.", ja: "偶然に価値あるものを見つけること。", ko: "우연히 가치 있는 것을 발견하는 일.", "zh-CN": "偶然发现有价值的事物。",
    }),
    examples: [
      { sentence: "Finding the book was pure serendipity.", translation: "Kitabı bulmak tam bir şanstı." },
      { sentence: "Their meeting was a moment of serendipity.", translation: "Karşılaşmaları güzel bir tesadüftü." },
    ],
    grammar: [],
    example: "Finding the book was pure serendipity.",
    exampleTranslation: "Kitabı bulmak tam bir şanstı.",
  },
  es: {
    language: "es",
    tier: "B2",
    termKind: "word",
    term: "sobremesa",
    partOfSpeech: "noun",
    pronunciation: "so-bre-me-sa",
    translations: createLocalizedFixtureRecord("conversation after a meal", "yemek sonrası sohbet", {
      ru: "разговор после еды", ar: "محادثة بعد تناول الطعام", ja: "食後の会話", ko: "식사 후 대화", "zh-CN": "饭后交谈",
    }),
    definitions: createLocalizedFixtureRecord("Time spent talking at the table after a meal.", "Yemekten sonra masada sohbet ederek geçirilen zaman.", {
      ru: "Время, проведённое за разговором за столом после еды.", ar: "وقت يقضيه الناس في الحديث حول المائدة بعد تناول الطعام.", ja: "食事の後にテーブルで会話を楽しむ時間。", ko: "식사 후 식탁에 앉아 이야기를 나누는 시간.", "zh-CN": "饭后在餐桌旁聊天的时间。",
    }),
    examples: [
      { sentence: "La sobremesa duró una hora.", translation: "Yemek sonrası sohbet bir saat sürdü." },
      { sentence: "Disfrutamos de una larga sobremesa.", translation: "Uzun bir yemek sonrası sohbetin tadını çıkardık." },
    ],
    grammar: [],
    example: "La sobremesa duró una hora.",
    exampleTranslation: "Yemek sonrası sohbet bir saat sürdü.",
  },
  de: {
    language: "de",
    tier: "B1",
    termKind: "word",
    term: "Wanderlust",
    partOfSpeech: "noun",
    pronunciation: "van-der-lust",
    translations: createLocalizedFixtureRecord("strong desire to travel", "güçlü seyahat etme arzusu", {
      ru: "сильное желание путешествовать", ar: "رغبة قوية في السفر", ja: "旅行への強い願い", ko: "강한 여행 욕구", "zh-CN": "强烈的旅行愿望",
    }),
    definitions: createLocalizedFixtureRecord("A strong desire to travel and explore.", "Seyahat etme ve yeni yerler keşfetme isteği.", {
      ru: "Сильное желание путешествовать и исследовать новые места.", ar: "رغبة قوية في السفر واستكشاف أماكن جديدة.", ja: "旅をして新しい場所を探検したいという強い願い。", ko: "여행하며 새로운 장소를 탐험하고 싶은 강한 욕구.", "zh-CN": "强烈的旅行和探索新地方的愿望。",
    }),
    examples: [
      { sentence: "Die Wanderlust packte sie wieder.", translation: "Seyahat etme arzusu onu yeniden sardı." },
      { sentence: "Ihre Wanderlust führte sie nach Japan.", translation: "Seyahat tutkusu onu Japonya'ya götürdü." },
    ],
    grammar: [],
    example: "Die Wanderlust packte sie wieder.",
    exampleTranslation: "Seyahat etme arzusu onu yeniden sardı.",
  },
};

*/

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function noteKey(entry: NoteEntry) {
  return `${entry.profileId}:${entry.note.id}`;
}

function isDraftForNote(draft: OfflineGeneratedCardDraft, entry: NoteEntry) {
  const sourceProfileId = draft.sourceProfileId || draft.storageProfileId;
  return draft.noteId === entry.note.id && sourceProfileId === entry.profileId;
}

function getLanguageName(language: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(language)
      ?? LANGUAGES.find((entry) => entry.code === language)?.nativeName
      ?? language;
  } catch {
    return LANGUAGES.find((entry) => entry.code === language)?.nativeName ?? language;
  }
}

async function isApplicationReachable() {
  if (!navigator.onLine) return false;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch("/api/offline/reachability", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildPendingOfflineVocabularyCard(entry: DraftEntry) {
  const preview = buildPreviewVocabularyCard(entry.draft.generated);
  const sourceKey = `offline-pending:${entry.profileId}:${entry.draft.id}`;
  return { ...preview, id: sourceKey, sourceKey };
}

function isTransientCardAddFailure(error: unknown) {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== "object" || !("name" in error)) return false;
  return ["AbortError", "NetworkError", "TimeoutError"].includes(String(error.name));
}

export function OfflineNotesConversionOverlay() {
  return (
    <Suspense fallback={null}>
      <OfflineNotesConversionOverlayContent />
    </Suspense>
  );
}

function OfflineNotesConversionOverlayContent() {
  const { user } = useAuthSession();
  const { locale, t } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showMessage } = useAppMessage();
  const inventoryCards = useInventoryStore((state) => state.cards);
  const inventoryHydrated = useInventoryStore((state) => state.hydrated);
  const cloudEnabled = useInventoryStore((state) => state.cloudEnabled);
  const cloudLoading = useInventoryStore((state) => state.cloudLoading);
  const cloudLoadComplete = useInventoryStore((state) => state.cloudLoadComplete);
  const cloudError = useInventoryStore((state) => state.cloudError);
  const [phase, setPhase] = useState<OverlayPhase>("closed");
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [locallyAddedCards, setLocallyAddedCards] = useState<{ ownerId: string; termKeys: Set<string> }>(() => ({
    ownerId: "guest",
    termKeys: new Set(),
  }));
  const [conversionBusy, setConversionBusy] = useState(false);
  const [pendingDraftIds, setPendingDraftIds] = useState<Set<string>>(() => new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [subscriptionRestrictionOpen, setSubscriptionRestrictionOpen] = useState(false);
  const [activeCardLimitDetails, setActiveCardLimitDetails] = useState<{ addedCount: number; skippedCount: number } | null>(null);
  const [feedback, setFeedback] = useState<"conversion" | null>(null);
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(false);
  const [visualViewportHeight, setVisualViewportHeight] = useState(0);
  const notesRef = useRef(notes);
  const draftsRef = useRef(drafts);
  const activeConversionRef = useRef<Promise<void> | null>(null);
  const didAutoConvertRef = useRef(false);
  const dismissedRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const draftAddInFlightRef = useRef(false);
  const draftAddQueueRef = useRef(new Map<string, DraftEntry>());
  const draftPersistenceRef = useRef(new Map<string, Promise<void>>());
  const blockedByCardLimitRef = useRef(false);
  const flushDraftAddQueueRef = useRef<() => Promise<void>>(async () => undefined);
  const manualCleanupRef = useRef<Promise<void> | null>(null);
  const autoCloseAfterDeckAddRef = useRef(false);
  const visualTestInitializedRef = useRef(false);
  const visualTestNotesRef = useRef<NoteEntry[]>([]);
  const showMessageRef = useRef(showMessage);
  const translateRef = useRef(t);
  const userId = user?.id ?? null;

  useEffect(() => {
    notesRef.current = notes;
    draftsRef.current = drafts;
  }, [drafts, notes]);

  useEffect(() => {
    showMessageRef.current = showMessage;
    translateRef.current = t;
  }, [showMessage, t]);

  useEffect(() => {
    const updateViewportHeight = () => {
      setVisualViewportHeight(window.visualViewport?.height ?? window.innerHeight);
    };
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);
    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  const currentPathname = pathname ?? "";
  const isOfflineScreen = OFFLINE_PATHS.has(currentPathname);
  const visualTestParam = searchParams.get("visualTest");
  const isOfflineVisualTest = currentPathname === "/visual-test-offline";
  const isAvailable = !isOfflineScreen && !isOfflineVisualTest;
  // This test must run on the real landing route. That keeps the authenticated
  // custom-card response and the landing dashboard render path in the loop.
  // `/visual-test-offline` intentionally remains an isolated offline screen.
  const isVisualTestMode = visualTestParam === "offline-notes" || visualTestParam === "offline-notes-add";
  const canCheckDeck = inventoryHydrated && (!cloudEnabled || (cloudLoadComplete && !cloudLoading && !cloudError));
  const deckCardTermIndex = useMemo(() => createDeckCardTermIndex(inventoryCards), [inventoryCards]);
  const currentOwnerId = userId ?? "guest";
  const locallyAddedTermIndex = locallyAddedCards.ownerId === currentOwnerId
    ? locallyAddedCards.termKeys
    : EMPTY_TERM_INDEX;
  const currentDeckTermIndex = useMemo(() => {
    const terms = new Set(deckCardTermIndex);
    for (const term of locallyAddedTermIndex) terms.add(term);
    return terms;
  }, [deckCardTermIndex, locallyAddedTermIndex]);
  const addableDrafts = useMemo(
    () => canCheckDeck ? getDraftsNotInDeck(drafts, currentDeckTermIndex) : [],
    [canCheckDeck, currentDeckTermIndex, drafts],
  );

  useEffect(() => {
    if (!isOfflineScreen) return;
    dismissedRef.current = false;
    didAutoConvertRef.current = false;
  }, [isOfflineScreen]);

  const convertSavedNotesRef = useRef<(pendingNotes: NoteEntry[], storageProfileId: string, knownDrafts: DraftEntry[]) => Promise<void>>(async () => undefined);

  const refreshPending = useCallback(async () => {
    if (!isAvailable || !navigator.onLine || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      const draftProfileId = userId ?? "guest";
      let nextNotes: NoteEntry[];

      const profileIds = unique([userId ?? "guest", "guest"]);
      const draftGroups = await Promise.all(
        profileIds.map((profileId) => listOfflineGeneratedDrafts(profileId).catch(() => [])),
      );
      if (isVisualTestMode) {
        nextNotes = visualTestNotesRef.current;
      } else {
        const noteGroups = await Promise.all(
          profileIds.map((profileId) => listOfflineSavedNotes(profileId).catch(() => [])),
        );
        nextNotes = noteGroups.flat().map((entry) => ({ ...entry, note: entry.note }));
      }
      const nextDrafts = draftGroups.flat().map((entry) => ({ ...entry, draft: entry.draft }));
      const visibleDrafts = nextDrafts.filter((entry) => !entry.draft.pendingAdd);
      if (draftAddInFlightRef.current) return;
      setNotes(nextNotes);
      setDrafts(visibleDrafts);

      // A pending optimistic add survives route changes and remounts in the
      // same IndexedDB draft record. Rehydrate it into the retry queue.
      for (const entry of nextDrafts) {
        if (!entry.draft.pendingAdd || draftAddQueueRef.current.has(entry.draft.id)) continue;
        draftAddQueueRef.current.set(entry.draft.id, entry);
        useInventoryStore.getState().registerPendingCustomCard(buildPendingOfflineVocabularyCard(entry));
        setPendingDraftIds((current) => {
          const next = new Set(current);
          next.add(entry.draft.id);
          return next;
        });
        setLocallyAddedCards((current) => {
          const termKeys = current.ownerId === currentOwnerId ? new Set(current.termKeys) : new Set<string>();
          termKeys.add(getGeneratedCardTermKey(entry.draft.generated));
          return { ownerId: currentOwnerId, termKeys };
        });
      }

      if (nextNotes.length === 0 && visibleDrafts.length === 0) {
        if (draftAddQueueRef.current.size === 0) {
          dismissedRef.current = false;
          didAutoConvertRef.current = false;
          setFeedback(null);
        }
        if (phase !== "closed") setPhase("closing");
        return;
      }

      if (!(await isApplicationReachable())) return;

      if (!dismissedRef.current && phase === "closed") setPhase("opening");
      if (nextNotes.length > 0 && !didAutoConvertRef.current) {
        didAutoConvertRef.current = true;
        window.setTimeout(() => {
          // The user can close the menu during the same event-loop turn that
          // schedules conversion. Do not start a new conversion after the
          // cleanup pass has been requested.
          if (dismissedRef.current) return;
          void convertSavedNotesRef.current(nextNotes, draftProfileId, nextDrafts);
        }, 0);
      }
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [currentOwnerId, isAvailable, isVisualTestMode, phase, userId]);

  useEffect(() => {
    if (!isAvailable || !isVisualTestMode) {
      visualTestInitializedRef.current = false;
      visualTestNotesRef.current = [];
      return;
    }
    if (!visualTestInitializedRef.current) {
      visualTestInitializedRef.current = true;
      visualTestNotesRef.current = createOfflineNotesVisualTestNotes(locale);
      dismissedRef.current = false;
      didAutoConvertRef.current = false;
    }
    const frame = window.requestAnimationFrame(() => void refreshPending());
    return () => window.cancelAnimationFrame(frame);
  }, [isAvailable, isVisualTestMode, locale, refreshPending]);

  useEffect(() => {
    convertSavedNotesRef.current = async (pendingNotes, storageProfileId, knownDrafts) => {
      if (activeConversionRef.current) return activeConversionRef.current;
      if (dismissedRef.current) return;
      setConversionBusy(true);
      setFeedback(null);

      const operation = (async () => {
        const availableDrafts = [...knownDrafts];

        const convertBatch = async (entries: NoteEntry[]) => {
          const failedEntries: NoteEntry[] = [];
          const entriesToGenerate: NoteEntry[] = [];

          const removeNoteFromOverlay = (entry: NoteEntry) => {
            if (isVisualTestMode) {
              visualTestNotesRef.current = visualTestNotesRef.current.filter((candidate) => noteKey(candidate) !== noteKey(entry));
            }
            setNotes((current) => current.filter((candidate) => noteKey(candidate) !== noteKey(entry)));
          };

          for (const entry of entries) {
            const existingDraft = availableDrafts.find((candidate) => isDraftForNote(candidate.draft, entry));
            if (existingDraft) {
              try {
                await removeOfflineSavedNote(entry.profileId, entry.note.id);
                removeNoteFromOverlay(entry);
              } catch (error) {
                failedEntries.push(entry);
                console.warn("[FoxiesDeck offline] Converted note cleanup failed.", {
                  targetLanguage: entry.note.targetLanguage,
                  errorCode: error instanceof Error ? error.message : "unknown_error",
                });
              }
              continue;
            }
            entriesToGenerate.push(entry);
          }

          if (entriesToGenerate.length === 0) return failedEntries;
          if (!navigator.onLine) return [...failedEntries, ...entriesToGenerate];

          let generatedCards: GeneratedCardResponse[];
          try {
            const response = await fetch("/api/cards/generate-batch", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                cards: entriesToGenerate.map((entry) => ({
                  locale: entry.note.nativeLocale,
                  term: entry.note.text,
                  targetLanguage: entry.note.targetLanguage,
                  direction: "learning-to-native",
                })),
              }),
            });
            const payload = await response.json().catch(() => null) as { cards?: unknown } | null;
            if (!response.ok || !Array.isArray(payload?.cards) || payload.cards.length !== entriesToGenerate.length) {
              throw new Error("offline_note_batch_generation_failed");
            }

            generatedCards = [];
            for (const card of payload.cards) {
              const generated = generatedCardSchema.safeParse(card);
              if (!generated.success) throw new Error("offline_note_batch_generation_failed");
              generatedCards.push(generated.data);
            }
          } catch (error) {
            console.warn("[FoxiesDeck offline] Saved-note batch generation failed.", {
              noteCount: entriesToGenerate.length,
              targetLanguages: unique(entriesToGenerate.map((entry) => entry.note.targetLanguage)),
              errorCode: error instanceof Error ? error.message : "unknown_error",
            });
            return [...failedEntries, ...entriesToGenerate];
          }

          for (const [index, entry] of entriesToGenerate.entries()) {
            try {
              const generated = generatedCards[index]!;
              const draft: OfflineGeneratedCardDraft = {
                id: window.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
                noteId: entry.note.id,
                sourceProfileId: entry.profileId,
                storageProfileId,
                targetLanguage: generated.language,
                generated,
                createdAt: new Date().toISOString(),
              };

              // Commit each generated card before deleting its source note.
              await saveOfflineGeneratedDraft(storageProfileId, draft);
              const savedDraftEntry = { profileId: storageProfileId, draft };
              availableDrafts.push(savedDraftEntry);
              setDrafts((current) => current.some((candidate) => candidate.draft.id === draft.id)
                ? current
                : [...current, savedDraftEntry]);
              await removeOfflineSavedNote(entry.profileId, entry.note.id);
              removeNoteFromOverlay(entry);
            } catch (error) {
              failedEntries.push(entry);
              console.warn("[FoxiesDeck offline] Generated note could not be saved locally.", {
                targetLanguage: entry.note.targetLanguage,
                errorCode: error instanceof Error ? error.message : "unknown_error",
              });
            }
          }

          return failedEntries;
        };

        let failedEntries = await convertBatch(pendingNotes);
        if (failedEntries.length > 0 && navigator.onLine) {
          failedEntries = await convertBatch(failedEntries);
        }

        if (failedEntries.length > 0) {
          setFeedback("conversion");
          showMessageRef.current(translateRef.current("offline.notes.conversionError"), "error");
        }
      })();

      activeConversionRef.current = operation;
      try {
        await operation;
      } finally {
        activeConversionRef.current = null;
        setConversionBusy(false);
      }
    };
  }, [isVisualTestMode]);

  useEffect(() => {
    if (!isAvailable) return;
    let cancelled = false;

    const refresh = () => {
      if (cancelled) return;
      void refreshPending().finally(() => {
        if (!cancelled) void flushDraftAddQueueRef.current();
      });
    };
    const handleOffline = () => {
      dismissedRef.current = false;
      setPhase((current) => current === "closed" || current === "closing" ? current : "closing");
    };
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 8_000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [isAvailable, refreshPending]);

  useEffect(() => {
    if (phase === "opening") {
      const frame = window.requestAnimationFrame(() => setPhase("open"));
      return () => window.cancelAnimationFrame(frame);
    }
    if (phase === "closing") {
      const timer = window.setTimeout(() => setPhase("closed"), OVERLAY_ANIMATION_MS);
      return () => window.clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    if (!isAvailable || phase === "closed") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAvailable, phase]);

  const discardLocalConversionData = useCallback(async () => {
    if (manualCleanupRef.current) return manualCleanupRef.current;

    const cleanup = (async () => {
      // A conversion already in progress may commit a draft after the user
      // taps close. Wait for that operation before taking the final snapshot
      // of local records so nothing is recreated after cleanup.
      try {
        await activeConversionRef.current;
      } catch {
        // Conversion errors are already surfaced by the conversion flow.
      }

      const profileIds = unique([userId ?? "guest", "guest"]);
      const storedNotes = isVisualTestMode
        ? []
        : (await Promise.all(profileIds.map((profileId) => listOfflineSavedNotes(profileId).catch(() => [])))).flat();
      const storedDrafts = (await Promise.all(profileIds.map((profileId) => listOfflineGeneratedDrafts(profileId).catch(() => [])))).flat();
      const queuedDraftIds = new Set(draftAddQueueRef.current.keys());
      const notesToDelete = new Map<string, NoteEntry>();
      for (const entry of [...storedNotes, ...(isVisualTestMode ? [] : notesRef.current)]) {
        notesToDelete.set(`${entry.profileId}:${entry.note.id}`, entry);
      }
      const draftsToDelete = new Map<string, DraftEntry>();
      for (const entry of [...storedDrafts, ...draftsRef.current]) {
        if (queuedDraftIds.has(entry.draft.id)) continue;
        draftsToDelete.set(`${entry.profileId}:${entry.draft.id}`, entry);
      }

      await Promise.allSettled([
        ...[...notesToDelete.values()].map((entry) => removeOfflineSavedNote(entry.profileId, entry.note.id)),
        ...[...draftsToDelete.values()].map((entry) => removeOfflineGeneratedDraft(entry.profileId, entry.draft.id)),
      ]);

      if (isVisualTestMode) {
        visualTestNotesRef.current = [];
      }
      setNotes([]);
      setDrafts((current) => current.filter((entry) => queuedDraftIds.has(entry.draft.id)));
      setFeedback(null);
    })();

    manualCleanupRef.current = cleanup;
    try {
      await cleanup;
    } finally {
      manualCleanupRef.current = null;
    }
  }, [isVisualTestMode, userId]);

  const closeOverlay = useCallback(() => {
    dismissedRef.current = true;
    setDiscardConfirmationOpen(false);
    setPhase((current) => current === "closed" || current === "closing" ? current : "closing");
    void discardLocalConversionData();
  }, [discardLocalConversionData]);

  const closeOverlayPreservingData = useCallback(() => {
    dismissedRef.current = true;
    setDiscardConfirmationOpen(false);
    setPhase((current) => current === "closed" || current === "closing" ? current : "closing");
  }, []);

  const requestDiscardConfirmation = useCallback(() => {
    setDiscardConfirmationOpen(true);
  }, []);

  useEffect(() => {
    if (
      !autoCloseAfterDeckAddRef.current ||
      drafts.length > 0 ||
      conversionBusy ||
      draftAddInFlightRef.current ||
      draftAddQueueRef.current.size > 0
    ) return;
    autoCloseAfterDeckAddRef.current = false;
    closeOverlay();
  }, [closeOverlay, conversionBusy, drafts.length, pendingDraftIds.size]);

  useEffect(() => {
    if (!isAvailable || phase === "closed") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (subscriptionRestrictionOpen) return;
        if (discardConfirmationOpen) setDiscardConfirmationOpen(false);
        else requestDiscardConfirmation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [discardConfirmationOpen, isAvailable, phase, requestDiscardConfirmation, subscriptionRestrictionOpen]);

  async function addDraftToDeck(entry: DraftEntry): Promise<"added" | "limit"> {
    try {
      const generated = entry.draft.generated;
      const optimisticCard = buildPendingOfflineVocabularyCard(entry);
      await useInventoryStore.getState().createCustomCard({
        language: generated.language,
        tier: generated.tier,
        termKind: generated.termKind,
        draft: {
          term: generated.term,
          partOfSpeech: generated.partOfSpeech,
          pronunciation: generated.pronunciation,
          translations: generated.translations,
          examples: generated.examples.map((example) => ({
            example: example.sentence,
            translation: example.translation,
          })),
          definitions: generated.definitions,
          grammar: generated.grammar,
          termKind: generated.termKind,
        },
        optimisticCard,
        idempotencyKey: entry.draft.id,
        onBackgroundError: (error) => {
          // The card is already visible locally. Restore the durable draft
          // after the current queue turn so a failed background sync remains
          // retryable instead of disappearing with the note.
          window.setTimeout(() => {
            void restoreDraftAfterRejectedAdd(entry);
            if (error.errorCode === "free_active_card_limit") {
              showActiveCardLimit(0, 1);
            }
          }, 0);
        },
      });
      return "added";
    } catch (error) {
      if (error instanceof InventoryActionError && error.errorCode === "free_active_card_limit") return "limit";
      throw error;
    }
  }

  function showActiveCardLimit(addedCount: number, remainingCount: number) {
    blockedByCardLimitRef.current = true;
    setActiveCardLimitDetails({ addedCount, skippedCount: remainingCount });
    setSubscriptionRestrictionOpen(true);
  }

  function markDraftAsOptimisticallyAdded(entry: DraftEntry): Promise<void> {
    draftAddQueueRef.current.set(entry.draft.id, entry);
    useInventoryStore.getState().registerPendingCustomCard(buildPendingOfflineVocabularyCard(entry));
    setPendingDraftIds((current) => {
      const next = new Set(current);
      next.add(entry.draft.id);
      return next;
    });
    setLocallyAddedCards((current) => {
      const termKeys = current.ownerId === currentOwnerId ? new Set(current.termKeys) : new Set<string>();
      termKeys.add(getGeneratedCardTermKey(entry.draft.generated));
      return { ownerId: currentOwnerId, termKeys };
    });

    const persistence = saveOfflineGeneratedDraft(entry.profileId, { ...entry.draft, pendingAdd: true }).catch((error) => {
      console.warn("[FoxiesDeck offline] Could not persist the pending card add.", error);
    });
    draftPersistenceRef.current.set(entry.draft.id, persistence);
    void persistence.finally(() => {
      if (draftPersistenceRef.current.get(entry.draft.id) === persistence) {
        draftPersistenceRef.current.delete(entry.draft.id);
      }
    });
    return persistence;
  }

  async function restoreDraftAfterRejectedAdd(entry: DraftEntry) {
    const restoredEntry: DraftEntry = {
      ...entry,
      draft: { ...entry.draft, pendingAdd: false },
    };
    try {
      await saveOfflineGeneratedDraft(entry.profileId, restoredEntry.draft);
    } catch (error) {
      console.warn("[FoxiesDeck offline] Could not persist the card-add recovery state.", {
        errorCode: error instanceof Error ? error.message : "unknown_error",
      });
    }

    draftAddQueueRef.current.delete(entry.draft.id);
    setPendingDraftIds((current) => {
      const next = new Set(current);
      next.delete(entry.draft.id);
      return next;
    });
    setDrafts((current) => current.some((candidate) => candidate.draft.id === entry.draft.id)
      ? current
      : [...current, restoredEntry]);
    autoCloseAfterDeckAddRef.current = false;
    if (!dismissedRef.current) {
      setPhase((current) => current === "closed" ? "opening" : current);
    }

    const cardIds = useInventoryStore.getState().cards;
    const restoredTermKeys = createDeckCardTermIndex(cardIds);
    for (const queued of draftAddQueueRef.current.values()) {
      restoredTermKeys.add(getGeneratedCardTermKey(queued.draft.generated));
    }
    setLocallyAddedCards({ ownerId: currentOwnerId, termKeys: restoredTermKeys });
  }

  async function flushDraftAddQueue() {
    if (draftAddInFlightRef.current || blockedByCardLimitRef.current || !navigator.onLine || draftAddQueueRef.current.size === 0) return;
    draftAddInFlightRef.current = true;
    let addedCount = 0;
    let restoredAfterFailure = false;

    try {
      if (!(await isApplicationReachable())) {
        if (autoCloseAfterDeckAddRef.current) {
          autoCloseAfterDeckAddRef.current = false;
          closeOverlay();
        }
        return;
      }

      for (const [draftId, entry] of [...draftAddQueueRef.current.entries()]) {
        let result: "added" | "limit";
        try {
          await draftPersistenceRef.current.get(draftId);
          result = await addDraftToDeck(entry);
        } catch (error) {
          if (!isTransientCardAddFailure(error)) {
            await restoreDraftAfterRejectedAdd(entry);
            restoredAfterFailure = true;
          } else if (autoCloseAfterDeckAddRef.current) {
            autoCloseAfterDeckAddRef.current = false;
            closeOverlay();
          }
          break;
        }

        if (result === "limit") {
          const skippedCount = draftAddQueueRef.current.size;
          await restoreDraftAfterRejectedAdd(entry);
          restoredAfterFailure = true;
          showActiveCardLimit(addedCount, skippedCount);
          break;
        }

        try {
          await removeOfflineGeneratedDraft(entry.profileId, draftId);
        } catch {
          // The server may already have committed the idempotent add. Keep the
          // durable queue record so a retry can safely confirm that result.
          break;
        }
        draftAddQueueRef.current.delete(draftId);
        setPendingDraftIds((current) => {
          const next = new Set(current);
          next.delete(draftId);
          return next;
        });
        setDrafts((current) => current.filter((candidate) => candidate.draft.id !== draftId));
        addedCount += 1;
      }
    } catch {
      // Network availability can change independently after the probe; keep
      // the idempotent draft queued for the next online/focus retry.
    } finally {
      draftAddInFlightRef.current = false;
    }

    if (addedCount > 0) {
      showMessage(
        addedCount === 1 ? t("offline.notes.addedToDeck") : t("offline.notes.addedAllToDeck", { count: addedCount }),
        "success",
      );
    }
    if (draftAddQueueRef.current.size > 0 && autoCloseAfterDeckAddRef.current) {
      autoCloseAfterDeckAddRef.current = false;
      closeOverlay();
    }
    // Keep the menu open while any generated card is still waiting for the
    // user. A single-card add must not close the conversion flow early.
    if (
      !restoredAfterFailure &&
      draftAddQueueRef.current.size === 0 &&
      notesRef.current.length === 0 &&
      draftsRef.current.length === 0
    ) {
      closeOverlay();
    }
  }

  useEffect(() => {
    flushDraftAddQueueRef.current = flushDraftAddQueue;
  });

  function handleAddDraft(entry: DraftEntry) {
    if (conversionBusy || pendingDraftIds.has(entry.draft.id)) return;
    vibrate("tap");
    autoCloseAfterDeckAddRef.current = true;
    setDrafts((current) => current.filter((candidate) => candidate.draft.id !== entry.draft.id));
    void markDraftAsOptimisticallyAdded(entry).then(() => flushDraftAddQueueRef.current());
  }

  function handleAddAllDrafts() {
    if (conversionBusy || !canCheckDeck || addableDrafts.length === 0) return;
    vibrate("tap");
    setBulkAdding(true);
    autoCloseAfterDeckAddRef.current = true;
    const queuedDraftIds = new Set(addableDrafts.map((entry) => entry.draft.id));
    setDrafts((current) => current.filter((entry) => !queuedDraftIds.has(entry.draft.id)));
    const persistOperations = addableDrafts.map(markDraftAsOptimisticallyAdded);
    void Promise.all(persistOperations).then(async () => {
      setBulkAdding(false);
      await flushDraftAddQueueRef.current();
    });
  }

  function handleConvertNotes(entries: NoteEntry[]) {
    void convertSavedNotesRef.current(entries, userId ?? "guest", drafts);
  }

  if (!isAvailable) return null;

  const isTransitioning = phase === "opening" || phase === "closing";
  const visibleNotes = notes.filter((entry) => !drafts.some((candidate) => isDraftForNote(candidate.draft, entry)));
  const content = phase === "closed" ? null : (
    <div
      data-offline-note-conversion-overlay
      data-offline-note-count={visibleNotes.length}
      data-offline-draft-count={drafts.length}
      data-offline-conversion-state={conversionBusy ? "processing" : feedback ?? "idle"}
      data-offline-visual-test={isVisualTestMode ? "true" : undefined}
      data-state={phase}
      className={cn(
        "fixed inset-0 z-[1900] flex items-center justify-center overflow-y-auto bg-black/65 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-opacity duration-[360ms] ease-[cubic-bezier(0.85,0,0.15,1)] sm:px-5",
        isTransitioning ? "opacity-0" : "opacity-100",
      )}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestDiscardConfirmation();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="offline-notes-title"
        style={{
          maxHeight: visualViewportHeight
            ? `calc(${visualViewportHeight}px - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 8rem - 100px)`
            : "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 8rem - 100px)",
        }}
        className={cn(
          "relative flex min-h-0 w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-background-card text-foreground shadow-sm transition-transform duration-[360ms] ease-[cubic-bezier(0.85,0,0.15,1)]",
          isTransitioning ? "translate-y-4" : "translate-y-0",
        )}
      >
        {discardConfirmationOpen ? (
          <>
            <div className="absolute inset-0 z-10 bg-black/75" aria-hidden="true" />
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="offline-notes-discard-title"
              className="absolute left-4 right-4 top-1/2 z-20 flex max-h-[calc(100%-2rem)] -translate-y-1/2 flex-col items-center gap-5 overflow-y-auto rounded-2xl bg-red-600 px-6 py-8 text-center text-white shadow-2xl"
            >
              <AlertTriangle className="size-10 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              <div className="space-y-2">
                <h2 id="offline-notes-discard-title" className="text-xl font-bold leading-tight">{t("offline.notes.discardTitle")}</h2>
                <p className="text-sm leading-relaxed text-white/90">{t("offline.notes.discardDescription")}</p>
              </div>
              <div className="grid w-full max-w-sm gap-2">
                <button
                  type="button"
                  onClick={closeOverlay}
                  className="flex min-h-14 w-full items-center justify-center rounded-lg bg-black px-4 text-base font-semibold text-white transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  {t("offline.notes.discardContinue")}
                </button>
                <button
                  type="button"
                  onClick={closeOverlayPreservingData}
                  className="flex min-h-14 w-full items-center justify-center rounded-lg bg-white px-4 text-base font-semibold text-red-600 transition-colors hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  {t("offline.notes.discardLater")}
                </button>
                <button
                  type="button"
                  onClick={() => setDiscardConfirmationOpen(false)}
                  className="flex min-h-14 w-full items-center justify-center rounded-lg border border-white/70 bg-transparent px-4 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                >
                  {t("offline.notes.discardBack")}
                </button>
              </div>
            </div>
          </>
        ) : null}
        <div className="relative flex shrink-0 items-start px-5 py-4 pr-14">
          <div className="min-w-0 flex-1">
            <h2 id="offline-notes-title" className="text-lg font-semibold leading-tight">{t("offline.notes.title")}</h2>
          </div>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={requestDiscardConfirmation}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-lg text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
          >
            <X className="size-6" strokeWidth={3} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {visibleNotes.map((entry) => (
            <article
              key={noteKey(entry)}
              data-offline-saved-note={entry.note.targetLanguage}
              className="flex min-w-0 items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2.5 text-black"
            >
              <div className="grid min-w-0 flex-1 gap-1 text-left">
                <div className="flex min-w-0 items-center gap-2 text-sm font-bold leading-tight">
                  <span aria-hidden="true" className="grid h-5 w-7 shrink-0 place-items-center overflow-hidden rounded-[5px]">
                    <LanguageFlag code={entry.note.targetLanguage} className="h-full w-full" imageClassName="scale-100" />
                  </span>
                  <span className="min-w-0 break-words">{getLanguageName(entry.note.targetLanguage, locale)}</span>
                </div>
                <p dir="auto" className="min-w-0 break-words text-[18px] leading-[1.3]">
                  {entry.note.text}
                </p>
              </div>
            </article>
          ))}

          {drafts.length > 0 ? (
            <div className="grid grid-cols-2 items-start gap-3">
              {drafts.map((entry) => {
                const generated = entry.draft.generated;
                const previewCard = buildPreviewVocabularyCard(generated);
                const card = { ...previewCard, id: entry.draft.id, sourceKey: entry.draft.id };
                const adding = pendingDraftIds.has(entry.draft.id);
                const termKey = getGeneratedCardTermKey(generated);
                const alreadyInDeck = canCheckDeck && currentDeckTermIndex.has(termKey);
                return (
                  <div
                    key={`${entry.profileId}:${entry.draft.id}`}
                    data-offline-generated-draft={generated.language}
                    data-offline-draft-already-in-deck={alreadyInDeck ? "true" : "false"}
                    className="flex min-w-0 flex-col"
                  >
                    <VocabularyCardView
                      card={card}
                      showActions={false}
                      translationLocale={locale}
                      className="w-full"
                    />
                    <Button
                      type="button"
                      onClick={() => void handleAddDraft(entry)}
                      disabled={!canCheckDeck || alreadyInDeck || adding || bulkAdding || conversionBusy}
                      aria-busy={adding}
                      className="mt-2 min-h-11 w-full rounded-lg border border-white/80 bg-white/95 px-3 text-base font-bold leading-tight hover:bg-white disabled:cursor-wait disabled:opacity-70"
                      style={{ color: getCardDesignTierPalette(card.tier).label }}
                    >
                      {alreadyInDeck
                        ? t("offline.notes.alreadyInDeck")
                        : adding
                          ? t("offline.notes.addingToDeck")
                          : t("offline.notes.addToDeck")}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : null}

        </div>

        {addableDrafts.length > 0 || !canCheckDeck && drafts.length > 0 || visibleNotes.length > 0 ? (
          <div className="flex shrink-0 flex-col gap-2 bg-background-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
            {drafts.length > 0 && (!canCheckDeck || addableDrafts.length > 0) ? (
              <button
                type="button"
                disabled={!canCheckDeck || conversionBusy || bulkAdding}
                onClick={() => void handleAddAllDrafts()}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-base font-bold leading-tight text-brand-foreground transition-[filter,transform] active:translate-y-0.5 active:brightness-95 disabled:cursor-wait disabled:opacity-70"
                style={{ boxShadow: "0 3px 0 color-mix(in srgb, var(--brand) 72%, black)" }}
              >
                {bulkAdding || !canCheckDeck ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <Plus className="size-5" aria-hidden="true" />}
                {bulkAdding ? t("offline.notes.addingAllToDeck") : !canCheckDeck ? t("common.loading") : t("offline.notes.addAllToDeck")}
              </button>
            ) : null}
            {visibleNotes.length > 0 && (feedback === "conversion" || drafts.length === 0) ? (
              <button
                type="button"
                disabled={conversionBusy || bulkAdding || pendingDraftIds.size > 0}
                onClick={() => void handleConvertNotes(visibleNotes)}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground transition-[filter,transform] active:translate-y-0.5 active:brightness-95 disabled:cursor-wait disabled:opacity-70"
                style={{ boxShadow: "0 3px 0 color-mix(in srgb, var(--brand) 72%, black)" }}
              >
                {conversionBusy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
                {conversionBusy ? t("offline.notes.converting") : feedback === "conversion" ? t("offline.notes.retry") : t("offline.notes.convertAll")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeOverlayPreservingData}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 text-base font-bold leading-tight text-white transition-[filter,transform] active:translate-y-0.5 active:brightness-95 disabled:cursor-wait disabled:opacity-70"
              style={{ boxShadow: "0 3px 0 color-mix(in srgb, #3b82f6 72%, black)" }}
            >
              <Clock3 className="size-5" aria-hidden="true" />
              {t("offline.notes.later")}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );

  return (
    <>
      {content ? createPortal(content, document.body) : null}
      <UpgradeDialog
        open={subscriptionRestrictionOpen}
        errorCode="free_active_card_limit"
        activeCardLimitDetails={activeCardLimitDetails}
        activeCardLimitDescription={activeCardLimitDetails
          ? t("offline.notes.limitReachedDescription", {
              addedCount: activeCardLimitDetails.addedCount,
              remainingCount: activeCardLimitDetails.skippedCount,
            })
          : undefined}
        overlayClassName="z-[2100]"
        onOpenChange={(open) => {
          setSubscriptionRestrictionOpen(open);
          if (!open) setActiveCardLimitDetails(null);
        }}
        onPurchaseSuccess={() => {
          blockedByCardLimitRef.current = false;
          void flushDraftAddQueueRef.current();
        }}
      />
    </>
  );
}
