import type { Metadata } from "next";
import { CardDrawWorkbench } from "@/features/cards/components/card-draw-workbench";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { LANGUAGES } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import type { LanguageCode, Tier } from "@/types/domain";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("page.cardDraw.title"),
    description: t("page.cardDraw.description"),
    pathname: "/card-draw",
  });
}

interface CardDrawPageProps {
  searchParams: Promise<{
    language?: string;
    tier?: string;
  }>;
}

export default async function CardDrawPage({ searchParams }: CardDrawPageProps) {
  const params = await searchParams;
  const initialLanguage = asLanguageCode(params.language);
  const initialTier = asTier(params.tier);

  return (
    <section
      className="animate-screen-pop mx-auto h-full max-w-7xl px-4 py-10 max-lg:fixed max-lg:inset-x-0 max-lg:top-16 max-lg:bottom-[var(--mobile-nav-bar-height)] max-lg:h-auto max-lg:max-w-none max-lg:overflow-hidden max-lg:px-0 max-lg:py-0 sm:px-6 lg:px-8"
      data-card-draw-page
    >
      <CardDrawWorkbench initialLanguage={initialLanguage} initialTier={initialTier} />
    </section>
  );
}

function asLanguageCode(value: string | undefined): LanguageCode | undefined {
  if (!value) return undefined;
  return LANGUAGES.find((language) => language.code === value)?.code;
}

function asTier(value: string | undefined): Tier | undefined {
  if (!value) return undefined;
  return TIERS.find((tier) => tier === value);
}
