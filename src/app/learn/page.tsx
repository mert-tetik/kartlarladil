import type { Metadata } from "next";
import { LearnQuizShell } from "@/app/learn/components/learn-quiz-shell";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { LANGUAGES } from "@/data/languages";
import type { LanguageCode, PracticeMode } from "@/types/domain";

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

function parseLanguage(value: string | string[] | undefined): LanguageCode | null {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (!rawValue) {
    return null;
  }

  return LANGUAGES.find((language) => language.code === rawValue)?.code ?? null;
}

function parseLearnedCelebrationTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseStreakTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseResultTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseResultMessageTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseBonusTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
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
  const initialLanguage = parseLanguage(params.language);
  const learnedCelebrationTest = parseLearnedCelebrationTest(params["learned-celebration-test"]);
  const streakTest = parseStreakTest(params["streak-test"]);
  const resultTest = parseResultTest(params["result-test"]);
  const resultMessageTest = parseResultMessageTest(params["result-message-test"]);
  const bonusTest = parseBonusTest(params["bonus-test"]);

  return (
    <section
      className="animate-screen-pop mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col justify-center px-4 py-10 max-lg:h-[calc(100dvh-var(--mobile-nav-bar-height))] max-lg:w-full max-lg:max-w-none max-lg:overflow-hidden max-lg:px-0 max-lg:py-0 lg:px-8"
      data-learn-page
    >
      <LearnQuizShell
        title={t("page.learn.title")}
        description={t("page.learn.description")}
        initialMode={initialMode}
        initialLanguage={initialLanguage}
        learnedCelebrationTest={learnedCelebrationTest}
        streakTest={streakTest}
        resultTest={resultTest}
        resultMessageTest={resultMessageTest}
        bonusTest={bonusTest}
      />
    </section>
  );
}
