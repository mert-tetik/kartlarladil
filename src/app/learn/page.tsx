import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("page.learn.title"),
    description: t("page.learn.description"),
    pathname: "/learn",
    noIndex: true,
  });
}

export default async function LearnPage() {
  await requireAuthUser("/learn");
  const t = createTranslator(await getServerLocale());

  return (
    <section
      className="animate-screen-pop mx-auto flex max-w-7xl flex-col justify-center px-4 py-10 max-lg:h-[calc(100dvh-8rem)] max-lg:overflow-hidden max-lg:py-4 sm:px-6 lg:px-8"
      data-learn-page
    >
      <div data-learn-page-header className="max-lg:hidden">
        <PageHeader
          title={t("page.learn.title")}
          description={t("page.learn.description")}
          mascot="/mascots/mascot5.png"
          mascotSize="lg"
        />
      </div>
      <div className="flex flex-1 flex-col justify-center overflow-y-auto">
        <QuizStation mode="active" />
      </div>
    </section>
  );
}
