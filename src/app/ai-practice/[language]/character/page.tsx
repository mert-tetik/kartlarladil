import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLanguageCode } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { requireAuthUser } from "@/features/auth/auth-session";
import { AiPracticeCharacterSelection } from "@/features/ai-practice/components/ai-practice-character-selection";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
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

  return buildMetadata({
    locale,
    title: t("page.aiPractice.charactersTitle"),
    description: t("page.aiPractice.description"),
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

  const { tier: rawTier } = await searchParams;
  const tier: Tier =
    typeof rawTier === "string" && (TIERS as readonly string[]).includes(rawTier) ? (rawTier as Tier) : "A1";

  return (
    <section className="animate-screen-pop mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-7xl flex-col px-4 py-6 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[var(--mobile-nav-bar-height)] max-lg:top-[var(--app-header-height)] max-lg:h-auto max-lg:min-h-0 max-lg:overflow-hidden max-lg:px-0 max-lg:py-4 sm:px-6 lg:px-8">
      <div className="flex w-full flex-1 min-h-0 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-center px-4 text-center">
          <h1 className={cn("font-display text-2xl font-semibold text-foreground sm:text-3xl", canUseSuperWater(locale) && "font-super-water")}>
            {formatSuperWaterText(locale, t("page.aiPractice.charactersTitle"))}
          </h1>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 overflow-hidden">
          <AiPracticeCharacterSelection language={rawLanguage} locale={locale} tier={tier} />
        </div>
      </div>
    </section>
  );
}
