import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireAuthUser } from "@/features/auth/auth-session";
import { AiPracticeLanguageSelection } from "@/features/ai-practice/components/ai-practice-language-selection";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("page.aiPractice.title"),
    description: t("page.aiPractice.description"),
    pathname: "/ai-practice",
    noIndex: true,
  });
}

export default async function AiPracticePage() {
  await requireAuthUser("/ai-practice");

  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return (
    <section className="animate-screen-pop mx-auto flex min-h-[calc(100dvh-8rem)] max-w-7xl flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full">
        <PageHeader
          title={t("page.aiPractice.title")}
          description={t("page.aiPractice.chooseLanguagePrompt")}
          descriptionClassName="text-sm sm:text-base"
        />
        <div className="mx-auto mt-8 max-w-3xl">
          <AiPracticeLanguageSelection locale={locale} />
        </div>
      </div>
    </section>
  );
}
