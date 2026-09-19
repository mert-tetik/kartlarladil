"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { CustomCardDirectionToggle } from "@/app/components/custom-card-direction-toggle";
import {
  MobileCustomCardLanguagePicker,
  usesNonLatinWritingSystem,
} from "@/app/components/mobile-custom-card-language-picker";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { findCustomCardMatch } from "@/features/cards/custom-card-matching";
import { generateCardRequest } from "@/features/cards/create-card-client";
import { localCardRepository } from "@/features/cards/card-repository";
import { InventoryActionError, useInventoryStore } from "@/features/inventory/inventory-store";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn, normalizeSearch } from "@/lib/utils";
import { getLanguageDisplayName } from "@/i18n/labels";
import type { CreateCardDirection, GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { LanguageCode, LimitErrorCode, VocabularyCard } from "@/types/domain";

const PREVIEW_EXPAND_DELAY_MS = 400;
const PREVIEW_REVEAL_DELAY_MS = 1_170;

export function MobileCustomCardSheet({ open, onClose, onSubscriptionLimitReached, landingLanguage }: { open: boolean; onClose: () => void; onSubscriptionLimitReached?: (errorCode: LimitErrorCode) => void; landingLanguage: LanguageCode }) {
  const { locale } = useLocale();
  const t = useT();
  const createCustomCard = useInventoryStore((state) => state.createCustomCard);
  const addCard = useInventoryStore((state) => state.addCard);
  const cards = useInventoryStore((state) => state.cards);
  const activeCardLimit = useInventoryStore((state) => state.activeCardLimit);
  const [term, setTerm] = useState("");
  const [targetLanguage, setTargetLanguage] = useState<LanguageCode>(landingLanguage);
  const [direction, setDirection] = useState<CreateCardDirection>("learning-to-native");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<VocabularyCard | null>(null);
  const [aiResponse, setAiResponse] = useState<GeneratedCardResponse | null>(null);
  const [error, setError] = useState("");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewRevealed, setPreviewRevealed] = useState(false);
  const [previewReturning, setPreviewReturning] = useState(false);
  const [cardAddedMessageVisible, setCardAddedMessageVisible] = useState(false);
  const [sheetElement, setSheetElement] = useState<HTMLDivElement | null>(null);
  const [sheetSize, setSheetSize] = useState({ width: 390, height: 660 });
  const returnTimer = useRef<number | null>(null);
  const cardAddedMessageTimer = useRef<number | null>(null);
  const transliterationHint = usesNonLatinWritingSystem(targetLanguage)
    ? t("createCard.targetLanguage.transliterationHint", {
        language: getLanguageDisplayName(targetLanguage, locale),
      })
    : null;
  const inputLanguage = direction === "native-to-learning" ? locale : targetLanguage;
  const termPlaceholder = t("createCard.termPlaceholder", {
    language: getLanguageDisplayName(inputLanguage, locale),
  });

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      setTargetLanguage(landingLanguage);
      setDirection("learning-to-native");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [landingLanguage, open]);

  useEffect(() => {
    if (!preview || previewReturning) return;

    const expandTimer = window.setTimeout(() => setPreviewExpanded(true), PREVIEW_EXPAND_DELAY_MS);
    const revealTimer = window.setTimeout(() => setPreviewRevealed(true), PREVIEW_REVEAL_DELAY_MS);

    return () => {
      window.clearTimeout(expandTimer);
      window.clearTimeout(revealTimer);
    };
  }, [preview, previewReturning]);

  useEffect(() => () => {
    if (returnTimer.current) window.clearTimeout(returnTimer.current);
    if (cardAddedMessageTimer.current) window.clearTimeout(cardAddedMessageTimer.current);
  }, []);

  useEffect(() => {
    if (!sheetElement) return;

    const updateSize = () => {
      const nextSize = { width: sheetElement.clientWidth, height: sheetElement.clientHeight };
      setSheetSize((currentSize) => currentSize.width === nextSize.width && currentSize.height === nextSize.height ? currentSize : nextSize);
    };
    const measureTimer = window.setTimeout(updateSize, 0);
    const observer = new ResizeObserver(updateSize);
    observer.observe(sheetElement);

    return () => {
      window.clearTimeout(measureTimer);
      observer.disconnect();
    };
  }, [sheetElement]);

  function handleClose() {
    clearCardAddedMessage();
    onClose();
  }

  function clearCardAddedMessage() {
    if (cardAddedMessageTimer.current) {
      window.clearTimeout(cardAddedMessageTimer.current);
      cardAddedMessageTimer.current = null;
    }
    setCardAddedMessageVisible(false);
  }

  function showCardAddedMessage() {
    if (cardAddedMessageTimer.current) {
      window.clearTimeout(cardAddedMessageTimer.current);
    }
    setCardAddedMessageVisible(true);
    cardAddedMessageTimer.current = window.setTimeout(() => {
      setCardAddedMessageVisible(false);
      cardAddedMessageTimer.current = null;
    }, 3000);
  }

  const showPreview = (card: VocabularyCard) => {
    clearCardAddedMessage();
    setPreviewExpanded(false);
    setPreviewRevealed(false);
    setPreviewReturning(false);
    setPreview(card);
  };
  async function generate() {
    const normalized = normalizeSearch(term);
    if (!normalized) return;
    setLoading(true); setError(""); clearCardAddedMessage(); setPreview(null); setAiResponse(null); setPreviewExpanded(false); setPreviewRevealed(false); setPreviewReturning(false);
    try {
      const match = findCustomCardMatch({
        cards: localCardRepository.list({ language: targetLanguage }),
        term,
        inputLanguage: locale,
        targetLanguage,
        direction,
      });
      if (match) { showPreview(match); setTerm(""); return; }
      const result = await generateCardRequest({ locale, term: term.trim(), targetLanguage, direction });
      setAiResponse(result); showPreview(buildPreviewVocabularyCard(result)); setTerm("");
    } catch (error) {
      const limitError = getSubscriptionLimitError(error);
      if (limitError) {
        onSubscriptionLimitReached?.(limitError);
      } else {
        setError(t("createCard.error.unknown"));
      }
    } finally { setLoading(false); }
  }
  function add() {
    if (!preview) return;
    setError("");

    if (
      activeCardLimit !== null &&
      cards.filter((card) => card.status === "active").length >= activeCardLimit
    ) {
      onSubscriptionLimitReached?.("free_active_card_limit");
      return;
    }

    if (aiResponse) {
      const optimisticId = `pending-custom:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const optimisticCard = { ...preview, id: optimisticId, sourceKey: optimisticId };

      void createCustomCard({
        language: aiResponse.language,
        tier: aiResponse.tier,
        termKind: aiResponse.termKind,
        draft: {
          term: aiResponse.term,
          partOfSpeech: aiResponse.partOfSpeech,
          pronunciation: aiResponse.pronunciation,
          translations: aiResponse.translations,
          example: aiResponse.example,
          exampleTranslation: aiResponse.exampleTranslation,
          definitions: aiResponse.definitions,
          grammar: aiResponse.grammar,
          termKind: aiResponse.termKind,
        },
        optimisticCard,
      }).then(() => {
        showCardAddedMessage();
      }).catch((error: unknown) => {
        if (error instanceof InventoryActionError && error.errorCode === "free_active_card_limit") {
          onSubscriptionLimitReached?.(error.errorCode);
        }
      });

      setTerm("");
      closePreview();
      return;
    }

    void addCard(preview.sourceKey)
      .then((result) => {
        if (result.limitReached) {
          onSubscriptionLimitReached?.("free_active_card_limit");
          return;
        }
        if (result.ok) {
          showCardAddedMessage();
        }
      })
      .catch(() => undefined);
    setTerm("");
    closePreview();
  }
  const alreadyAdded = preview ? cards.some((card) => card.cardId === preview.sourceKey || card.cardId === preview.id) : false;
  const previewTarget = {
    left: Math.max(0, (sheetSize.width - 190) / 2),
    top: Math.max(48, (sheetSize.height - 253) / 2 - 120),
    width: 190,
    height: 253,
  };
  function closePreview() {
    if (!preview || previewReturning) return;
    setPreviewRevealed(false);
    setPreviewReturning(true);
    returnTimer.current = window.setTimeout(() => {
      setPreview(null);
      setAiResponse(null);
      setPreviewExpanded(false);
      setPreviewReturning(false);
      returnTimer.current = null;
    }, 320);
  }
  const previewPosition = previewExpanded
    ? previewTarget
    : { left: previewTarget.left, top: sheetSize.height - 208, width: 92, height: 123 };
  const previewScale = (previewPosition.width / previewTarget.width) * (previewReturning ? 0.78 : 1);
  const previewTransform = `translate3d(${previewPosition.left - previewTarget.left}px, ${previewPosition.top - previewTarget.top}px, 0) scale(${previewScale})`;
  return (
    <MobileBottomSheetShell
      open={open}
      onClose={handleClose}
      title={t("createCard.mobileTitle")}
      panelLabel={t("createCard.mobileTitle")}
      tutorialLayer="custom-card"
      panelClassName="h-[78dvh] max-h-[94dvh]"
      contentRef={setSheetElement}
      visual={<Plus className="size-[3.25rem] stroke-[2.5] text-brand-foreground" aria-hidden="true" />}
      contentClassName="relative overflow-hidden p-5"
    >
      {cardAddedMessageVisible || transliterationHint ? (
        <p
          className={cn(
            "pointer-events-none absolute inset-x-5 bottom-[4.5rem] z-10 text-center text-xl font-bold leading-7 text-white",
            cardAddedMessageVisible && "rounded-md bg-action-learn px-4 py-2 shadow-sm",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {formatSuperWaterText(
            locale,
            cardAddedMessageVisible ? t("createCard.success.added") : transliterationHint ?? "",
          )}
        </p>
      ) : null}
      <div className={cn("relative z-10 flex flex-1 flex-col pt-4 transition-[opacity,transform] duration-300 ease-out", preview ? "pointer-events-none -translate-y-4 opacity-0" : "translate-y-0 opacity-100")}>
        <div className="mt-3">
          <CustomCardDirectionToggle value={direction} onChange={setDirection} learningLanguage={targetLanguage} />
        </div>
        <div className="mt-3">
          <MobileCustomCardLanguagePicker value={targetLanguage} onChange={setTargetLanguage} />
        </div>
        <input id="mobile-custom-term" value={term} onChange={(event) => setTerm(event.target.value)} placeholder={termPlaceholder} className="control-gradient-outline mt-3 h-12 w-full rounded-full px-3 text-black outline-none placeholder:text-black/50" />
        <button type="button" disabled={!term.trim() || loading} onClick={generate} className="control-gradient-outline mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-black disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {loading ? t("createCard.generating") : t("createCard.generate")}
        </button>
      </div>
      {preview ? (
        <>
          <div className="absolute z-20 h-[253px] w-[190px]" style={{ left: `${previewTarget.left}px`, top: `${previewTarget.top}px` }}>
            <div className={cn("size-full origin-top-left transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.85,0,0.15,1)]", previewReturning && "opacity-0")} style={{ transform: previewTransform }}>
              <VocabularyCardView card={preview} initialFace="back" face={previewRevealed && !previewReturning ? "front" : "back"} flippable={false} showActions={false} frontFit className="aspect-[3/4] !min-h-0 size-full max-sm:!aspect-[3/4] max-sm:!min-h-0" />
            </div>
          </div>
          <div className={cn("absolute inset-x-5 z-20 grid grid-cols-2 gap-2 transition-[opacity,transform] duration-300 ease-out", previewRevealed && !previewReturning ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")} style={{ top: `${previewTarget.top + previewTarget.height + 24}px` }}>
            <button data-mobile-custom-card-preview-back type="button" disabled={!previewRevealed || previewReturning} onClick={closePreview} className={cn("h-12 rounded-md bg-black text-lg font-semibold text-white disabled:pointer-events-none", canUseSuperWater(locale) && "font-super-water")}>{formatSuperWaterText(locale, t("common.back"))}</button>
            <button type="button" disabled={!previewRevealed || previewReturning || alreadyAdded} onClick={add} className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-md bg-action-learn text-lg font-semibold text-white disabled:opacity-50", canUseSuperWater(locale) && "font-super-water")}>{formatSuperWaterText(locale, alreadyAdded ? t("createCard.alreadyInDeck") : t("createCard.add"))}</button>
          </div>
        </>
      ) : null}
      {error ? <p role="alert" className="relative z-30 mt-3 text-sm text-destructive">{error}</p> : null}
    </MobileBottomSheetShell>
  );
}

function getSubscriptionLimitError(error: unknown): LimitErrorCode | null {
  if (!(error instanceof Error)) return null;

  switch (error.message) {
    case "free_active_card_limit":
    case "free_learned_card_limit":
    case "ai_daily_limit":
    case "ai_monthly_limit":
      return error.message;
    default:
      return null;
  }
}
