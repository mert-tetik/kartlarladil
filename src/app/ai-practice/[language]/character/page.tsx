import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isLanguageCode } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { LanguageFlag } from "@/components/language-flag";
import { requireAuthUser } from "@/features/auth/auth-session";
import { AiPracticeCharacterSelection } from "@/features/ai-practice/components/ai-practice-character-selection";
import { createTranslator } from "@/i18n/dictionaries";
import { getLanguageDisplayName } from "@/i18n/labels";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import type { Tier } from "@/types/domain";

type AiPracticeCharacterSelectionPageProps = {
  params: Promise<{ language: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: AiPracticeCharacterSelectionPageProps): Promise<Metadata> {
  const { language: rawLanguage } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const languageName = isLanguageCode(rawLanguage) ? getLanguageDisplayName(rawLanguage, locale) : undefined;

  return buildMetadata({
    locale,
    title: languageName
      ? `${t("page.aiPractice.charactersTitle")} — ${languageName}`
      : t("page.aiPractice.charactersTitle"),
    description: t("page.aiPractice.charactersDescription", { language: languageName ?? "" }),
    pathname: `/ai-practice/${rawLanguage}/character`,
    noIndex: true,
  });
}

export default async function AiPracticeCharacterSelectionPage({
  params,
  searchParams,
}: AiPracticeCharacterSelectionPageProps) {
  const { language: rawLanguage } = await params;

  if (!isLanguageCode(rawLanguage)) {
    redirect("/ai-practice");
  }

  await requireAuthUser(`/ai-practice/${rawLanguage}/character`);

  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const languageName = getLanguageDisplayName(rawLanguage, locale);

  const { tier: rawTier } = await searchParams;
  const tier: Tier =
    typeof rawTier === "string" && (TIERS as readonly string[]).includes(rawTier) ? (rawTier as Tier) : "A1";

  return (
    <section className="animate-screen-pop mx-auto max-w-7xl px-4 py-6 max-lg:py-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-foreground">{t("page.aiPractice.charactersTitle")}</h1>
        <Link
          href={`/ai-practice/${rawLanguage}`}
          aria-label={t("common.back")}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-background-card text-foreground transition-colors hover:bg-background-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-background-card px-3 py-1.5 text-sm font-semibold text-foreground-secondary">
        <LanguageFlag code={rawLanguage} className="h-5 w-7" />
        {languageName}
      </div>

      <div className="mt-6">
        <AiPracticeCharacterSelection language={rawLanguage} locale={locale} tier={tier} />
      </div>
    </section>
  );
}
