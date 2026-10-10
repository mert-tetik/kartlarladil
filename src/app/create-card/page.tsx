"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Library, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomCardDirectionToggle } from "@/app/components/custom-card-direction-toggle";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import {
  CardGrammarDetailsButton,
  CardGrammarDetailsOverlay,
} from "@/features/cards/components/card-grammar-details-overlay";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { createCustomCardFromGenerated } from "@/features/cards/custom-card-creation";
import { findCustomCardMatch } from "@/features/cards/custom-card-matching";
import { generateCardRequest } from "@/features/cards/create-card-client";
import { localCardRepository } from "@/features/cards/card-repository";
import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useLocale, useT } from "@/i18n/locale-provider";
import { getLanguageDisplayName } from "@/i18n/labels";
import type { CreateCardDirection, GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { TranslationKey } from "@/i18n/types";
import type { LanguageCode, VocabularyCard } from "@/types/domain";
import { cn } from "@/lib/utils";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { useAppMessage } from "@/components/app-message-provider";

const ADD_TO_DECK_TIMEOUT_MS = 20000;
const CREATE_CARD_PREVIEW_EXIT_DURATION_MS = 1_080;
const CREATE_CARD_FRAME_CLASS_NAME =
  "relative flex h-screen w-full items-start justify-center overflow-hidden px-4 py-4 sm:px-6 sm:py-6";

export default function CreateCardPage() {
  const { user } = useAuthSession();
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const { showMessage } = useAppMessage();
  const createCustomCard = useInventoryStore((state) => state.createCustomCard);
  const addCard = useInventoryStore((state) => state.addCard);
  const cards = useInventoryStore((state) => state.cards);

  const [term, setTerm] = useState("");
  const [direction, setDirection] = useState<CreateCardDirection>("learning-to-native");
  const targetLanguage = resolveDesktopTargetLanguage(locale, user?.profile.preferredLanguageCode);
  const inputLanguage = direction === "native-to-learning" ? locale : targetLanguage;
  const termPlaceholder = t("createCard.termPlaceholder", {
    language: getLanguageDisplayName(inputLanguage, locale),
  });
  const [foundCard, setFoundCard] = useState<VocabularyCard | null>(null);
  const [aiResponse, setAiResponse] = useState<GeneratedCardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [grammarDetailsOpen, setGrammarDetailsOpen] = useState(false);
  const createCardButtonText = loading ? t("createCard.generating") : t("createCard.generate");
  const formattedCreateCardButtonText = formatSuperWaterText(locale, createCardButtonText);
  const useSuperWaterForCreateCardButton = canUseSuperWater(locale);

  useEffect(() => {
    if (!user) {
      navigateWithRouteTransition(() => router.replace(`/register?next=${encodeURIComponent("/create-card")}`));
    }
  }, [user, router]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (!foundCard) {
      setOverlayVisible(false);
      setGrammarDetailsOpen(false);
      return;
    }

    const showTimer = window.setTimeout(() => setOverlayVisible(true), 10);
    return () => window.clearTimeout(showTimer);
  }, [foundCard]);

  const isAlreadyInDeck = cards.some((card) => card.cardId === foundCard?.sourceKey);

  async function handleGenerate() {
    const trimmedTerm = term.trim();
    if (!trimmedTerm) return;

    setLoading(true);
    setFoundCard(null);
    setAiResponse(null);
    setGrammarDetailsOpen(false);

    try {
      const selectedCard = findCustomCardMatch({
        cards: localCardRepository.list({ language: targetLanguage }),
        term: trimmedTerm,
        inputLanguage: locale,
        targetLanguage,
        direction,
      });

      if (selectedCard) {
        setFoundCard(selectedCard);
        return;
      }

      const result = await generateCardRequest({ locale, term: trimmedTerm, targetLanguage, direction });
      setAiResponse(result);
      setFoundCard(buildPreviewVocabularyCard(result));
    } catch (error) {
      showMessage(getErrorMessage(getThrownErrorMessage(error)), "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!foundCard) return;

    if (aiResponse) {
      const complete = () => {
        setFoundCard(null);
        setAiResponse(null);
        setGrammarDetailsOpen(false);
        setTerm("");
        setIsExiting(false);
        showMessage(t("createCard.success.addedWithLanguage", { language: getLanguageDisplayName(aiResponse.language, locale) }), "success");
      };

      void createCustomCardFromGenerated(aiResponse, createCustomCard).then(() => {
        window.setTimeout(complete, CREATE_CARD_PREVIEW_EXIT_DURATION_MS);
      }).catch(() => {
        setFoundCard(null);
        setAiResponse(null);
        setGrammarDetailsOpen(false);
        setIsExiting(false);
        showMessage(t("createCard.error.addFailed"), "error");
      });

      setIsExiting(true);
      return;
    }

    setAdding(true);
    try {
      const result = await withTimeout(addCard(foundCard.sourceKey), ADD_TO_DECK_TIMEOUT_MS);

      if (!result.ok) {
        throw new Error(result.limitReached ? "free_active_card_limit" : "unknown");
      }

      setIsExiting(true);
      window.setTimeout(() => {
        setFoundCard(null);
        setAiResponse(null);
        setGrammarDetailsOpen(false);
        setTerm("");
        setIsExiting(false);
        showMessage(t("createCard.success.addedWithLanguage", { language: getLanguageDisplayName(foundCard.language, locale) }), "success");
      }, CREATE_CARD_PREVIEW_EXIT_DURATION_MS);
    } catch {
      setIsExiting(true);
      window.setTimeout(() => {
        setFoundCard(null);
        setAiResponse(null);
        setIsExiting(false);
        showMessage(t("createCard.error.addFailed"), "error");
      }, CREATE_CARD_PREVIEW_EXIT_DURATION_MS);
    } finally {
      setAdding(false);
    }
  }

  function handleBack() {
    setIsExiting(true);
    window.setTimeout(() => {
      setFoundCard(null);
      setAiResponse(null);
      setGrammarDetailsOpen(false);
      setIsExiting(false);
    }, CREATE_CARD_PREVIEW_EXIT_DURATION_MS);
  }

  function getErrorMessage(code: string) {
    const normalizedCode = code.trim();

    if (!normalizedCode || normalizedCode === "unknown") {
      return t("createCard.error.unknown");
    }

    const key = `createCard.error.${normalizedCode}` as const;
    const message = t(key as TranslationKey);
    return message === key ? `System: ${normalizedCode}` : message;
  }

  if (!user) {
    return (
      <main data-create-card-page data-create-card-ready={clientReady} className={CREATE_CARD_FRAME_CLASS_NAME}>
        <Loader2 className="size-8 animate-spin text-foreground-muted" />
      </main>
    );
  }

  return (
    <main data-create-card-page data-create-card-ready={clientReady} className={CREATE_CARD_FRAME_CLASS_NAME}>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[50vh] w-screen">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/custom-card-page-bg.webp"
          alt=""
          className="h-full w-full object-cover object-bottom"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background/60 to-transparent" />
      </div>

      <section className="relative flex h-screen w-full flex-col items-center overflow-hidden">
        <div className="fixed inset-x-0 top-16 z-40 flex h-32 w-screen flex-col items-center justify-center gap-2 bg-red-500 px-4 shadow-sm">
          <Library className="size-11 shrink-0 text-white sm:size-14" aria-hidden="true" />
          <p className="max-w-md text-center text-sm font-medium text-white sm:text-base">
            {t("createCard.description")}
          </p>
        </div>

        <div
          data-create-card-form
          className="relative z-10 flex w-full max-w-md -translate-y-2 flex-col items-start gap-2 px-4 pt-36 text-left sm:gap-3 sm:pt-40"
        >
          <div className="mb-4 w-full space-y-3 text-left sm:mb-5">
            <CustomCardDirectionToggle value={direction} onChange={setDirection} learningLanguage={targetLanguage} />
            <p className="text-xs font-medium text-foreground-muted">
              {t("createCard.targetLanguage.label")}: {getLanguageDisplayName(targetLanguage, locale)}
            </p>
            <label htmlFor="term" className="text-sm font-medium">
              {t("createCard.term")}
            </label>
            <input
              id="term"
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onFocus={() => window.scrollTo(0, 0)}
              placeholder={termPlaceholder}
              maxLength={120}
              className="control-gradient-outline create-card-gradient-outline h-12 w-full rounded-full px-4 text-base text-black outline-none placeholder:text-gray-500"
            />
          </div>

          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={loading || !term.trim()}
            className="control-gradient-outline control-gradient-outline-brand create-card-gradient-outline h-12 w-full gap-2 rounded-full text-brand-foreground hover:bg-brand-hover"
          >
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Library className="size-5" />}
            <span className={cn(useSuperWaterForCreateCardButton && "font-super-water")}>
              {useSuperWaterForCreateCardButton
                ? formattedCreateCardButtonText
                : createCardButtonText}
            </span>
          </Button>
        </div>
      </section>

      {foundCard && (
        <div
          data-create-card-overlay
          className={cn(
            "absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80 px-3 py-4 backdrop-blur-sm transition-opacity duration-300 sm:px-6 sm:py-6",
            isExiting || !overlayVisible ? "opacity-0" : "opacity-100",
          )}
        >
          <div
            data-create-card-preview-state={
              isExiting ? "exit" : overlayVisible ? "enter" : "pre-enter"
            }
            className="flex h-full w-full max-w-md flex-col items-center justify-center gap-3 overflow-visible"
          >
            <div
              data-create-card-overlay-panel
              className="relative flex w-full min-h-0 max-h-[calc(100%-3.75rem)] flex-col items-center justify-center overflow-visible bg-transparent p-0"
            >
              <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                <div className="relative w-full max-w-[15rem] sm:max-w-[18rem]">
                  <div data-create-card-preview-item="grammar" className="absolute -left-1 top-[-3.25rem] z-30">
                    <CardGrammarDetailsButton onClick={() => setGrammarDetailsOpen(true)} />
                  </div>
                  <div data-create-card-preview-item="card">
                    <VocabularyCardView
                      card={foundCard}
                      initialFace="front"
                      flippable
                      showActions={false}
                      frontFit
                      className="h-auto min-h-0 w-full max-sm:aspect-[3/4]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid w-full shrink-0 grid-cols-2 gap-3">
              <Button
                data-create-card-preview-item="back"
                variant="secondary"
                size="sm"
                onClick={handleBack}
                disabled={adding}
                className="border-white bg-white text-black hover:bg-white/90 hover:text-black focus-visible:outline-white"
              >
                <ChevronLeft className="mr-1.5 size-3.5" />
                {t("common.back")}
              </Button>
              <Button
                data-create-card-preview-item="add"
                size="sm"
                onClick={handleAdd}
                disabled={adding || isAlreadyInDeck}
                className="bg-brand text-brand-foreground hover:bg-brand-hover"
              >
                {adding ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                {isAlreadyInDeck ? t("createCard.alreadyInDeck") : t("createCard.add")}
              </Button>
            </div>

            <CardGrammarDetailsOverlay
              card={foundCard}
              previewPayload={aiResponse}
              open={grammarDetailsOpen}
              nativeLocale={locale}
              onClose={() => setGrammarDetailsOpen(false)}
            />
          </div>
        </div>
      )}
    </main>
  );
}

function resolveDesktopTargetLanguage(locale: string, preferredLanguage?: LanguageCode | null): LanguageCode {
  if (preferredLanguage && preferredLanguage !== locale) {
    return preferredLanguage;
  }

  return locale === "en" ? "tr" : "en";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Add-to-deck request timed out after ${Math.round(timeoutMs / 1000)} seconds. Check the server action, Supabase request, or browser Network tab for the stalled request.`,
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function getThrownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim() || "unknown";
  }

  if (typeof error === "string") {
    return error.trim() || "unknown";
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }

    try {
      const serialized = JSON.stringify(record);
      return serialized && serialized !== "{}" ? serialized : "unknown";
    } catch {
      return "unknown";
    }
  }

  return "unknown";
}
