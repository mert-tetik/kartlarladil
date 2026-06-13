import { PageHeader } from "@/components/page-header";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";

export default async function LearnPage() {
  const t = createTranslator(await getServerLocale());

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={t("page.learn.title")} description={t("page.learn.description")} />
      <div className="mt-8">
        <QuizStation mode="active" />
      </div>
    </section>
  );
}
