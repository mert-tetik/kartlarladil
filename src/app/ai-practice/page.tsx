import { PageHeader } from "@/components/page-header";
import { requireAuthUser } from "@/features/auth/auth-session";
import { AiPracticeLanguageSelection } from "@/features/ai-practice/components/ai-practice-language-selection";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";

export default async function AiPracticePage() {
  await requireAuthUser("/ai-practice");

  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={t("page.aiPractice.title")} description={t("page.aiPractice.description")} />
      <div className="mt-8">
        <AiPracticeLanguageSelection locale={locale} />
      </div>
    </section>
  );
}
