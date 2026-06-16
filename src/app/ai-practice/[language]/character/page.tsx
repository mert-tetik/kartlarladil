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
import type { Tier } from "@/types/domain";

type AiPracticeCharacterSelectionPageProps = {
  params: Promise<{ language: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

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
    <section className="mx-auto max-w-7xl px-4 py-6 max-lg:py-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold text-slate-950">{t("page.aiPractice.charactersTitle")}</h1>
        <Link
          href={`/ai-practice/${rawLanguage}`}
          aria-label={t("common.back")}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-950 transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700">
        <LanguageFlag code={rawLanguage} className="h-5 w-7" />
        {languageName}
      </div>

      <div className="mt-6">
        <AiPracticeCharacterSelection language={rawLanguage} locale={locale} tier={tier} />
      </div>
    </section>
  );
}
