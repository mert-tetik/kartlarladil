import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLanguageCode } from "@/data/languages";
import { requireAuthUser } from "@/features/auth/auth-session";
import { AiPracticeTierSelection } from "@/features/ai-practice/components/ai-practice-tier-selection";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { getLanguageDisplayName } from "@/i18n/labels";
import { buildMetadata } from "@/lib/seo/metadata";

type AiPracticeTierPageProps = {
  params: Promise<{ language: string }>;
};

export async function generateMetadata({ params }: AiPracticeTierPageProps): Promise<Metadata> {
  const { language: rawLanguage } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const languageName = isLanguageCode(rawLanguage) ? getLanguageDisplayName(rawLanguage, locale) : undefined;

  return buildMetadata({
    locale,
    title: languageName ? `${t("page.aiPractice.tierTitle")} — ${languageName}` : t("page.aiPractice.tierTitle"),
    description: t("page.aiPractice.description"),
    pathname: `/ai-practice/${rawLanguage}`,
    noIndex: true,
  });
}

export default async function AiPracticeTierPage({ params }: AiPracticeTierPageProps) {
  const { language: rawLanguage } = await params;

  if (!isLanguageCode(rawLanguage)) {
    redirect("/ai-practice");
  }

  await requireAuthUser(`/ai-practice/${rawLanguage}`);

  return (
    <section className="animate-screen-pop mx-auto flex min-h-full w-full max-w-7xl flex-col items-center justify-center px-4 py-6 max-lg:py-4 sm:px-6 lg:px-8">
      <AiPracticeTierSelection language={rawLanguage} />
    </section>
  );
}
