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

  useEffect(() => {
    if (!user) {
      router.replace(`/register?next=${encodeURIComponent("/create-card")}`);
    }
  }, [user, router]);

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
      setErrorCode(error instanceof Error ? error.message : "unknown");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!generated) return;

    setAdding(true);
    setErrorCode(null);

    try {
      await createCustomCard({
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
      });

      router.push("/my-cards");
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "unknown");
      setAdding(false);
    }
  }

  function handleSkip() {
    setGenerated(null);
    setErrorCode(null);
  }

  function getErrorMessage(code: string) {
    const key = `createCard.error.${code}` as const;
    const message = t(key as TranslationKey);
    return message === key ? t("createCard.error.unknown") : message;
  }

  if (!user) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-4">
        <Loader2 className="size-8 animate-spin text-foreground-muted" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-var(--app-header-height))] max-lg:min-h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] w-full max-w-xl flex-col items-center justify-center px-4 py-6 sm:py-10">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("createCard.title")}</h1>
          <p className="text-foreground-muted">{t("createCard.description")}</p>
        </div>

        <div className="space-y-2">
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
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {getErrorMessage(errorCode)}
          </div>
        )}

        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={loading || !term.trim()}
          className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-hover"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          {loading ? t("createCard.generating") : t("createCard.generate")}
        </Button>
      </div>

      {previewCard && (
        <div className="fixed inset-x-0 top-[var(--app-header-height)] bottom-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm max-lg:bottom-[var(--mobile-nav-bar-height)]">
          <div className="flex max-h-full w-full max-w-md flex-col items-center justify-center gap-4">
            <div
              className={cn(
                "relative w-full overflow-hidden rounded-2xl border border-white/10 bg-black p-4 shadow-2xl",
                "sm:p-6",
              )}
            >
              <div className="mb-3 text-center sm:mb-4">
                <h2 className="text-base font-semibold text-white sm:text-lg">{t("createCard.previewTitle")}</h2>
                <p className="text-xs text-white/70 sm:text-sm">{t("createCard.previewDescription")}</p>
              </div>

              <div className="flex justify-center">
                <VocabularyCardView
                  card={previewCard}
                  initialFace="front"
                  flippable
                  showActions={false}
                  className="scale-90 sm:scale-100"
                />
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={handleSkip}
                disabled={adding}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <RefreshCcw className="mr-2 size-4" />
                {t("createCard.skip")}
              </Button>
              <Button
                size="md"
                onClick={handleAdd}
                disabled={adding}
                className="bg-brand text-brand-foreground hover:bg-brand-hover"
              >
                {adding ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {t("createCard.add")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
