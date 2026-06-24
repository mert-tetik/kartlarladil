import type { Metadata } from "next";
import { LearnQuizShell } from "@/app/learn/components/learn-quiz-shell";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import type { PracticeMode } from "@/types/domain";

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

function parsePracticeMode(value: string | string[] | undefined): PracticeMode | null {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (rawValue === "active" || rawValue === "learned") {
    return rawValue;
  }

  return null;
}

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuthUser("/learn");
  const t = createTranslator(await getServerLocale());
  const params = await searchParams;
  const initialMode = parsePracticeMode(params.mode);

  return (
    <section
      className="animate-screen-pop mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col justify-center px-4 py-10 max-lg:h-[calc(100dvh-var(--mobile-nav-bar-height))] max-lg:w-full max-lg:max-w-none max-lg:overflow-hidden max-lg:px-0 max-lg:py-0 sm:px-6 lg:px-8"
      data-learn-page
    >
      <LearnQuizShell
        title={t("page.learn.title")}
        description={t("page.learn.description")}
        initialMode={initialMode}
      />
    </section>
  );
}
