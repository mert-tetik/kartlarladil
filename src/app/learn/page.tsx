import { PageHeader } from "@/components/page-header";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";

export default async function LearnPage() {
  await requireAuthUser("/learn");
  const t = createTranslator(await getServerLocale());

  return (
    <section
      className="mx-auto flex max-w-7xl flex-col px-4 py-10 max-lg:h-[calc(100dvh-4rem)] max-lg:overflow-hidden max-lg:py-4 sm:px-6 lg:px-8"
      data-learn-page
    >
      <div data-learn-page-header className="max-lg:hidden">
        <PageHeader
          title={t("page.learn.title")}
          description={t("page.learn.description")}
          mascot="/mascots/mascot5.png"
        />
      </div>
      <div className="flex flex-1 flex-col">
        <QuizStation mode="active" />
      </div>
    </section>
  );
}
