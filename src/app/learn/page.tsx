import type { Metadata } from "next";
import { LearnQuizShell } from "@/app/learn/components/learn-quiz-shell";
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
      className="animate-screen-pop mx-auto flex max-w-7xl flex-col justify-center px-4 py-10 max-lg:h-[calc(100dvh-8rem)] max-lg:overflow-hidden max-lg:py-0 sm:px-6 lg:px-8"
      data-learn-page
    >
      <LearnQuizShell
        title={t("page.learn.title")}
        description={t("page.learn.description")}
      />
    </section>
  );
}
