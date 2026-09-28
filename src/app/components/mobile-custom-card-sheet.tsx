"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import {
  CardGrammarDetailsButton,
  CardGrammarDetailsOverlay,
} from "@/features/cards/components/card-grammar-details-overlay";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { CustomCardDirectionToggle } from "@/app/components/custom-card-direction-toggle";
import {
  MobileCustomCardLanguagePicker,
  usesNonLatinWritingSystem,
} from "@/app/components/mobile-custom-card-language-picker";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { createCustomCardFromGenerated } from "@/features/cards/custom-card-creation";
import { findCustomCardMatch } from "@/features/cards/custom-card-matching";
import { generateCardRequest } from "@/features/cards/create-card-client";
import { localCardRepository } from "@/features/cards/card-repository";
import { InventoryActionError, useInventoryStore } from "@/features/inventory/inventory-store";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn, normalizeSearch } from "@/lib/utils";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useAppMessage } from "@/components/app-message-provider";
import type { CreateCardDirection, GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { LanguageCode, LimitErrorCode, VocabularyCard } from "@/types/domain";

const PREVIEW_EXPAND_DELAY_MS = 400;
const PREVIEW_REVEAL_DELAY_MS = 1_170;

export function MobileCustomCardSheet({ open, onClose, onSubscriptionLimitReached, landingLanguage }: { open: boolean; onClose: () => void; onSubscriptionLimitReached?: (errorCode: LimitErrorCode) => void; landingLanguage: LanguageCode }) {
  const { locale } = useLocale();
  const t = useT();
  const { showMessage } = useAppMessage();
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
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewRevealed, setPreviewRevealed] = useState(false);
  const [previewReturning, setPreviewReturning] = useState(false);
  const [grammarDetailsOpen, setGrammarDetailsOpen] = useState(false);
  const [sheetElement, setSheetElement] = useState<HTMLDivElement | null>(null);
  const [sheetSize, setSheetSize] = useState({ width: 390, height: 660 });
  const returnTimer = useRef<number | null>(null);
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
    setGrammarDetailsOpen(false);
    onClose();
  }

  const showPreview = (card: VocabularyCard) => {
    setPreviewExpanded(false);
    setPreviewRevealed(false);
    setPreviewReturning(false);
    setPreview(card);
  };
  async function generate() {
    const normalized = normalizeSearch(term);
    if (!normalized) return;
    setLoading(true); setPreview(null); setAiResponse(null); setPreviewExpanded(false); setPreviewRevealed(false); setPreviewReturning(false); setGrammarDetailsOpen(false);
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
        showMessage(t("createCard.error.unknown"), "error");
      }
    } finally { setLoading(false); }
  }
  function add() {
    if (!preview) return;
    if (
      activeCardLimit !== null &&
      cards.filter((card) => card.status === "active").length >= activeCardLimit
    ) {
      onSubscriptionLimitReached?.("free_active_card_limit");
      return;
    }

    if (aiResponse) {
      void createCustomCardFromGenerated(aiResponse, createCustomCard).then(() => {
        showMessage(t("createCard.success.addedWithLanguage", { language: getLanguageDisplayName(aiResponse.language, locale) }), "success");
      }).catch((error: unknown) => {
        if (error instanceof InventoryActionError && error.errorCode === "free_active_card_limit") {
          onSubscriptionLimitReached?.(error.errorCode);
          return;
        }
        showMessage(t("createCard.error.addFailed"), "error");
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
        if (!result.ok) {
          showMessage(t("createCard.error.addFailed"), "error");
          return;
        }
        showMessage(t("createCard.success.addedWithLanguage", { language: getLanguageDisplayName(preview.language, locale) }), "success");
      })
      .catch(() => showMessage(t("createCard.error.addFailed"), "error"));
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
    setGrammarDetailsOpen(false);
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
      tone="purple"
      panelClassName="h-[78dvh] max-h-[94dvh]"
      contentRef={setSheetElement}
      visual={<Plus className="size-[3.25rem] stroke-[3.25] text-purple-600" aria-hidden="true" />}
      contentClassName="relative overflow-hidden p-5"
    >
      <div className={cn("relative z-10 flex flex-1 flex-col justify-center transition-[opacity,transform] duration-300 ease-out", preview ? "pointer-events-none -translate-y-4 opacity-0" : "-translate-y-6 opacity-100")}>
        <div className="mt-3">
          <CustomCardDirectionToggle value={direction} onChange={setDirection} learningLanguage={targetLanguage} />
        </div>
        <div className="mt-3">
          <MobileCustomCardLanguagePicker value={targetLanguage} onChange={setTargetLanguage} />
        </div>
        <input id="mobile-custom-term" value={term} onChange={(event) => setTerm(event.target.value)} placeholder={termPlaceholder} className="control-gradient-outline mt-3 h-12 w-full rounded-full px-3 text-black outline-none placeholder:text-black/50" />
        <button type="button" disabled={!term.trim() || loading} onClick={generate} className="control-gradient-outline mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-lg font-semibold font-super-water text-black disabled:opacity-50">
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {loading ? t("createCard.generating") : t("createCard.generate")}
        </button>
        {transliterationHint ? (
          <p
            className={cn(
              "pointer-events-none mt-2 text-center text-base font-bold leading-5 text-white",
              canUseSuperWater(locale) && "font-super-water",
            )}
          >
            {formatSuperWaterText(locale, transliterationHint)}
          </p>
        ) : null}
      </div>
      {preview ? (
        <>
          <div
            className="absolute left-8 right-8 z-30 mx-auto max-w-[24rem]"
            style={{ top: `${previewTarget.top + previewTarget.height + 12}px` }}
          >
            <CardGrammarDetailsButton
              onClick={() => setGrammarDetailsOpen(true)}
              showIcon={false}
              className="h-12 w-full max-w-none justify-center rounded-md border-0 bg-white px-3 text-lg font-semibold text-black shadow-none backdrop-blur-none hover:bg-white/90 hover:text-black"
            />
          </div>
          <div className="absolute z-20 h-[253px] w-[190px] -translate-y-8" style={{ left: `${previewTarget.left}px`, top: `${previewTarget.top}px` }}>
            <div className={cn("size-full origin-top-left transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.85,0,0.15,1)]", previewReturning && "opacity-0")} style={{ transform: previewTransform }}>
              <VocabularyCardView card={preview} initialFace="back" face={previewRevealed && !previewReturning ? "front" : "back"} flippable={false} showActions={false} frontFit className="aspect-[3/4] !min-h-0 size-full max-sm:!aspect-[3/4] max-sm:!min-h-0" />
            </div>
          </div>
          <div className={cn("absolute left-8 right-8 z-20 mx-auto grid max-w-[24rem] grid-cols-2 gap-2 transition-[opacity,transform] duration-300 ease-out", previewRevealed && !previewReturning ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0")} style={{ top: `${previewTarget.top + previewTarget.height + 72}px` }}>
            <button data-mobile-custom-card-preview-back type="button" disabled={!previewRevealed || previewReturning} onClick={closePreview} className={cn("h-12 rounded-md bg-red-600 text-lg font-semibold text-white hover:bg-red-500 disabled:pointer-events-none", canUseSuperWater(locale) && "font-super-water")}>{formatSuperWaterText(locale, t("common.back"))}</button>
            <button type="button" disabled={!previewRevealed || previewReturning || alreadyAdded} onClick={add} className={cn("inline-flex h-12 items-center justify-center gap-2 rounded-md bg-action-learn text-lg font-semibold text-white disabled:opacity-50", canUseSuperWater(locale) && "font-super-water")}>{formatSuperWaterText(locale, alreadyAdded ? t("createCard.alreadyInDeck") : t("createCard.add"))}</button>
          </div>
        </>
      ) : null}
      <CardGrammarDetailsOverlay
        card={preview}
        previewPayload={aiResponse}
        open={grammarDetailsOpen}
        nativeLocale={locale}
        tutorialLayer="custom-card"
        onClose={() => setGrammarDetailsOpen(false)}
      />
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
