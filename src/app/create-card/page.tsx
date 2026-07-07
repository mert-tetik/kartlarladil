"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Library, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { generateCardRequest } from "@/features/cards/create-card-client";
import { localCardRepository } from "@/features/cards/card-repository";
import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useLocale, useT } from "@/i18n/locale-provider";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { TranslationKey } from "@/i18n/types";
import type { VocabularyCard } from "@/types/domain";
import { cn, normalizeSearch } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound-effects";

const ADD_TO_DECK_TIMEOUT_MS = 20000;
const CREATE_CARD_FRAME_CLASS_NAME =
  "relative flex h-screen w-full items-start justify-center overflow-hidden px-4 py-4 sm:px-6 sm:py-6";

export default function CreateCardPage() {
  const { user } = useAuthSession();
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const createCustomCard = useInventoryStore((state) => state.createCustomCard);
  const addCard = useInventoryStore((state) => state.addCard);
  const cards = useInventoryStore((state) => state.cards);

  const [term, setTerm] = useState("");
  const [foundCard, setFoundCard] = useState<VocabularyCard | null>(null);
  const [aiResponse, setAiResponse] = useState<GeneratedCardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace(`/register?next=${encodeURIComponent("/create-card")}`);
    }
  }, [user, router]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (!toast) {
      setToastVisible(false);
      return;
    }

    const showTimer = window.setTimeout(() => setToastVisible(true), 10);
    let clearTimer: number | undefined;
    const hideTimer = window.setTimeout(() => {
      setToastVisible(false);
      clearTimer = window.setTimeout(() => setToast(null), 300);
    }, 1500);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      if (clearTimer) window.clearTimeout(clearTimer);
    };
  }, [toast]);

  useEffect(() => {
    if (!foundCard) {
      setOverlayVisible(false);
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
    setErrorCode(null);
    setFoundCard(null);
    setAiResponse(null);

    try {
      const catalogMatches = localCardRepository.list({ query: trimmedTerm });
      const normalizedTerm = normalizeSearch(trimmedTerm);
      const exactTermMatch = catalogMatches.find(
        (card) => normalizeSearch(card.term) === normalizedTerm,
      );
      const selectedCard = exactTermMatch ?? catalogMatches[0];

      if (selectedCard) {
        setFoundCard(selectedCard);
        playSoundEffect("card-ready");
        return;
      }

      const result = await generateCardRequest({ locale, term: trimmedTerm });
      setAiResponse(result);
      setFoundCard(buildPreviewVocabularyCard(result));
      playSoundEffect("card-ready");
    } catch (error) {
      setErrorCode(getThrownErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!foundCard) return;

    setAdding(true);
    setErrorCode(null);

    try {
      if (aiResponse) {
        await withTimeout(
          createCustomCard({
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
              grammar: aiResponse.grammar,
              termKind: aiResponse.termKind,
            },
          }),
          ADD_TO_DECK_TIMEOUT_MS,
        );
      } else {
        const result = await withTimeout(addCard(foundCard.sourceKey), ADD_TO_DECK_TIMEOUT_MS);

        if (!result.ok) {
          throw new Error(result.limitReached ? "free_active_card_limit" : "unknown");
        }
      }

      setIsExiting(true);
      window.setTimeout(() => {
        setFoundCard(null);
        setAiResponse(null);
        setTerm("");
        setIsExiting(false);
        setToast({ type: "success", message: t("createCard.success.added") });
      }, 300);
    } catch (error) {
      setIsExiting(true);
      window.setTimeout(() => {
        setFoundCard(null);
        setAiResponse(null);
        setIsExiting(false);
        setToast({ type: "error", message: t("createCard.error.addFailed") });
      }, 300);
    } finally {
      setAdding(false);
    }
  }

  function handleBack() {
    setIsExiting(true);
    window.setTimeout(() => {
      setFoundCard(null);
      setAiResponse(null);
      setErrorCode(null);
      setIsExiting(false);
    }, 300);
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
          src="/create-card-illustration.png"
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
          className="relative z-10 flex w-full max-w-md flex-col items-start gap-2 px-4 pt-36 text-left sm:gap-3 sm:pt-40"
        >
          <div className="w-full space-y-3 text-left mb-4 sm:mb-5">
            <label htmlFor="term" className="text-sm font-medium">
              {t("createCard.term")}
            </label>
            <input
              id="term"
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onFocus={() => window.scrollTo(0, 0)}
              placeholder={t("createCard.termPlaceholder")}
              maxLength={120}
              className="h-12 w-full rounded-md border border-border bg-white px-4 text-base text-black outline-none placeholder:text-gray-500 ring-2 ring-brand"
            />
          </div>

          {errorCode && (
            <div role="alert" className="w-full rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-left text-sm text-destructive">
              {getErrorMessage(errorCode)}
            </div>
          )}

          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={loading || !term.trim()}
            className="h-12 w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-hover"
          >
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Library className="size-5" />}
            {loading ? t("createCard.generating") : t("createCard.generate")}
          </Button>
        </div>
      </section>

      {toast && (
        <div
          className={cn(
            "fixed top-4 left-1/2 z-[60] -translate-x-1/2 transform rounded-lg px-4 py-2 shadow-lg transition-all duration-300 ease-out",
            toastVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
            toast.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white",
          )}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      {foundCard && (
        <div
          data-create-card-overlay
          className={cn(
            "absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80 px-3 py-4 backdrop-blur-sm transition-all duration-300 sm:px-6 sm:py-6",
            isExiting || !overlayVisible ? "opacity-0" : "opacity-100",
          )}
        >
          <div className="flex h-full w-full max-w-md flex-col items-center justify-center gap-3 overflow-hidden">
            <div
              data-create-card-overlay-panel
              className={cn(
                "relative flex w-full min-h-0 max-h-[calc(100%-3.75rem)] flex-col items-center justify-center overflow-hidden bg-transparent p-0 transition-all duration-300",
                isExiting || !overlayVisible ? "scale-95 opacity-0" : "scale-100 opacity-100",
              )}
            >
              <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                <div className="w-full max-w-[15rem] sm:max-w-[18rem]">
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

            {errorCode && (
              <div role="alert" className="w-full rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2 text-sm font-medium text-red-100">
                {getErrorMessage(errorCode)}
              </div>
            )}

            <div
              className={cn(
                "grid w-full shrink-0 grid-cols-2 gap-3 transition-all duration-300",
                isExiting || !overlayVisible ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100",
              )}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBack}
                disabled={adding}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <ChevronLeft className="mr-1.5 size-3.5" />
                {t("common.back")}
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={adding || isAlreadyInDeck}
                className="bg-brand text-brand-foreground hover:bg-brand-hover"
              >
                {adding ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                {isAlreadyInDeck ? t("createCard.alreadyInDeck") : t("createCard.add")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
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
