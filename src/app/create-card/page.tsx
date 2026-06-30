"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import { generateCardRequest } from "@/features/cards/create-card-client";
import { LANGUAGE_CODES, LANGUAGE_NAMES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useLocale, useT } from "@/i18n/locale-provider";
import type { LanguageCode, Tier, TermKind } from "@/types/domain";
import type { TranslationKey } from "@/i18n/types";
import { cn } from "@/lib/utils";

const TERM_KIND_OPTIONS = [
  { value: "word", labelKey: "createCard.termKindWord" },
  { value: "fixed_phrase", labelKey: "createCard.termKindPhrase" },
] as const satisfies { value: TermKind; labelKey: string }[];

export default function CreateCardPage() {
  const { user } = useAuthSession();
  const router = useRouter();
  const t = useT();
  const { locale } = useLocale();
  const createCustomCard = useInventoryStore((state) => state.createCustomCard);

  const [language, setLanguage] = useState<LanguageCode>("en");
  const [tier, setTier] = useState<Tier>("A1");
  const [termKind, setTermKind] = useState<TermKind>("word");
  const [topic, setTopic] = useState("");
  const [generated, setGenerated] = useState<Awaited<ReturnType<typeof generateCardRequest>> | null>(null);
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
    return buildPreviewVocabularyCard(language, tier, termKind, generated);
  }, [generated, language, tier, termKind]);

  async function handleGenerate() {
    setLoading(true);
    setErrorCode(null);
    setGenerated(null);

    try {
      const result = await generateCardRequest({
        language,
        locale,
        tier,
        termKind,
        topic: topic.trim() || undefined,
      });
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
        language,
        tier,
        termKind,
        draft: {
          term: generated.term,
          partOfSpeech: generated.partOfSpeech,
          pronunciation: generated.pronunciation,
          translations: generated.translations,
          example: generated.example,
          exampleTranslation: generated.exampleTranslation,
          grammar: generated.grammar,
          termKind,
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
    <main className="relative mx-auto max-w-2xl px-4 py-6 sm:py-10">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("createCard.title")}</h1>
          <p className="text-foreground-muted">{t("createCard.description")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="language" className="text-sm font-medium">
              {t("createCard.language")}
            </label>
            <select
              id="language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageCode)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {LANGUAGE_CODES.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGE_NAMES[code]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="tier" className="text-sm font-medium">
              {t("createCard.tier")}
            </label>
            <select
              id="tier"
              value={tier}
              onChange={(event) => setTier(event.target.value as Tier)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {TIERS.map((tierOption) => (
                <option key={tierOption} value={tierOption}>
                  {tierOption}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="termKind" className="text-sm font-medium">
              {t("createCard.termKind")}
            </label>
            <select
              id="termKind"
              value={termKind}
              onChange={(event) => setTermKind(event.target.value as TermKind)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {TERM_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey as TranslationKey)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="topic" className="text-sm font-medium">
              {t("createCard.topic")}
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder={t("createCard.topicPlaceholder")}
              maxLength={120}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
        </div>

        {errorCode && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {getErrorMessage(errorCode)}
          </div>
        )}

        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={loading}
          className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-hover"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
          {loading ? t("createCard.generating") : t("createCard.generate")}
        </Button>
      </div>

      {previewCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4">
            <div
              className={cn(
                "relative rounded-2xl border border-white/10 bg-black p-4 shadow-2xl",
                "sm:p-6",
              )}
            >
              <div className="mb-4 text-center">
                <h2 className="text-lg font-semibold text-white">{t("createCard.previewTitle")}</h2>
                <p className="text-sm text-white/70">{t("createCard.previewDescription")}</p>
              </div>

              <div className="flex justify-center">
                <VocabularyCardView card={previewCard} initialFace="front" flippable showActions={false} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleSkip}
                disabled={adding}
                className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <RefreshCcw className="mr-2 size-4" />
                {t("createCard.skip")}
              </Button>
              <Button
                size="lg"
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
