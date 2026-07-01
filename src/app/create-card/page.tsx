"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { generateCardRequest } from "@/features/cards/create-card-client";
import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useLocale, useT } from "@/i18n/locale-provider";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import type { TranslationKey } from "@/i18n/types";
import { cn } from "@/lib/utils";

const ADD_TO_DECK_TIMEOUT_MS = 20000;
const CREATE_CARD_FRAME_CLASS_NAME =
  "relative flex h-full w-full items-center justify-center overflow-hidden px-4 py-4 sm:px-6 sm:py-6";

export default function CreateCardPage() {
  const { user } = useAuthSession();
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const createCustomCard = useInventoryStore((state) => state.createCustomCard);

  const [term, setTerm] = useState("");
  const [generated, setGenerated] = useState<GeneratedCardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace(`/register?next=${encodeURIComponent("/create-card")}`);
    }
  }, [user, router]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const previewCard = useMemo(() => {
    if (!generated) return null;
    return buildPreviewVocabularyCard(generated);
  }, [generated]);

  async function handleGenerate() {
    if (!term.trim()) return;

    setLoading(true);
    setErrorCode(null);
    setGenerated(null);

    try {
      const result = await generateCardRequest({ locale, term: term.trim() });
      setGenerated(result);
    } catch (error) {
      setErrorCode(getThrownErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!generated) return;

    setAdding(true);
    setErrorCode(null);

    try {
      await withTimeout(
        createCustomCard({
          language: generated.language,
          tier: generated.tier,
          termKind: generated.termKind,
          draft: {
            term: generated.term,
            partOfSpeech: generated.partOfSpeech,
            pronunciation: generated.pronunciation,
            translations: generated.translations,
            example: generated.example,
            exampleTranslation: generated.exampleTranslation,
            grammar: generated.grammar,
            termKind: generated.termKind,
          },
        }),
        ADD_TO_DECK_TIMEOUT_MS,
      );

      router.push(`/?menu=active&language=${encodeURIComponent(generated.language)}`);
    } catch (error) {
      setErrorCode(getThrownErrorMessage(error));
    } finally {
      setAdding(false);
    }
  }

  function handleSkip() {
    setGenerated(null);
    setErrorCode(null);
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
      <section className="flex h-full w-full items-center justify-center">
        <div data-create-card-form className="flex w-full max-w-md flex-col items-center justify-center gap-4 text-center sm:gap-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("createCard.title")}</h1>
            <p className="text-sm text-foreground-muted sm:text-base">{t("createCard.description")}</p>
          </div>

          <div className="w-full space-y-2 text-left">
            <label htmlFor="term" className="text-sm font-medium">
              {t("createCard.term")}
            </label>
            <input
              id="term"
              type="text"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={t("createCard.termPlaceholder")}
              maxLength={120}
              className="h-12 w-full rounded-md border border-border bg-background px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
            {loading ? t("createCard.generating") : t("createCard.generate")}
          </Button>
        </div>
      </section>

      {previewCard && (
        <div
          data-create-card-overlay
          className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-6"
        >
          <div className="flex h-full w-full max-w-md flex-col items-center justify-center gap-3 overflow-hidden">
            <div
              data-create-card-overlay-panel
              className={cn(
                "relative flex w-full min-h-0 max-h-[calc(100%-3.75rem)] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black p-3 shadow-2xl",
                "sm:p-4",
              )}
            >
              <div className="mb-2 shrink-0 text-center">
                <h2 className="text-sm font-semibold text-white sm:text-base">{t("createCard.previewTitle")}</h2>
                <p className="text-xs text-white/70">{t("createCard.previewDescription")}</p>
              </div>

              <div className="flex min-h-0 w-full flex-1 items-center justify-center">
                <div className="w-full max-w-[15rem] sm:max-w-[18rem]">
                  <VocabularyCardView
                    card={previewCard}
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

            <div className="grid w-full shrink-0 grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSkip}
                disabled={adding}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <RefreshCcw className="mr-1.5 size-3.5" />
                {t("createCard.skip")}
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={adding}
                className="bg-brand text-brand-foreground hover:bg-brand-hover"
              >
                {adding ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                {t("createCard.add")}
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
