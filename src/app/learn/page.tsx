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

function parseCardProgressTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseStreakTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseStreakRewardTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseStartTest(value: string | string[] | undefined): boolean {
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

function parseChestRewardTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseContinuationMotivationTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseBonusTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseBonusRewardTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseBonusAfterEach(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseNormalTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseQuizWordButtonTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseQuizCompletionTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseQuizFlowTest(value: string | string[] | undefined): boolean {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return rawValue === "1" || rawValue === "true";
}

function parseNormalQuestionType(
  value: string | string[] | undefined,
): "choice" | "listening" | "definition" | "true-false" | "sentence-completion" | "text" | "group" | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const questionTypes = [
    "choice",
    "listening",
    "definition",
    "true-false",
    "sentence-completion",
    "text",
    "group",
  ] as const;

  return questionTypes.includes(rawValue as (typeof questionTypes)[number])
    ? (rawValue as (typeof questionTypes)[number])
    : null;
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
  const cardProgressTest = parseCardProgressTest(
    params["card-progress-test"] ?? params["quiz-card-progress-test"],
  );
  const startTest = parseStartTest(params["start-test"] ?? params["quiz-start-test"]);
  const streakTest = parseStreakTest(params["streak-test"]);
  const streakRewardTest = parseStreakRewardTest(params["streak-reward-test"]);
  const resultTest = parseResultTest(params["result-test"]);
  const resultMessageTest = parseResultMessageTest(params["result-message-test"]);
  const chestRewardTest = parseChestRewardTest(params["chest-reward-test"]);
  const continuationMotivationTest = parseContinuationMotivationTest(
    params["continuation-test"] ??
      params["continuation-motivation-test"] ??
      params["quiz-continuation-test"],
  );
  const bonusTest = parseBonusTest(params["bonus-test"]);
  const bonusRewardTest = parseBonusRewardTest(params["bonus-reward-test"]);
  const bonusAfterEach = parseBonusAfterEach(params["bonus-after-each"]);
  const normalTestValue = params["normal-test"] ?? params["quiz-normal-test"];
  const normalQuestionType = parseNormalQuestionType(
    params["normal-question"] ??
      params["normal-test-question"] ??
      params["quiz-normal-question"] ??
      params["quiz-normal-test-question"],
  );
  const normalTest = parseNormalTest(normalTestValue);
  const quizWordButtonTest = parseQuizWordButtonTest(
    params["quiz-word-button-test"] ?? params["quiz-button-test"],
  );
  const quizCompletionTest = parseQuizCompletionTest(params["quiz-completion-test"]);
  const quizFlowTest = parseQuizFlowTest(params["quiz-flow-test"]);

  return (
    <section
      className="animate-screen-pop mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col justify-center px-4 py-10 max-lg:h-dvh max-lg:w-full max-lg:max-w-none max-lg:overflow-hidden max-lg:px-0 max-lg:py-0 lg:px-8"
      data-learn-page
    >
      <LearnQuizShell
        title={t("page.learn.title")}
        description={t("page.learn.description")}
        initialMode={initialMode}
        initialLanguage={initialLanguage}
        learnedCelebrationTest={learnedCelebrationTest}
        cardProgressTest={cardProgressTest}
        startTest={startTest}
        streakTest={streakTest}
        streakRewardTest={streakRewardTest}
        resultTest={resultTest}
        resultMessageTest={resultMessageTest}
        chestRewardTest={chestRewardTest}
        continuationMotivationTest={continuationMotivationTest}
        bonusTest={bonusTest}
        bonusRewardTest={bonusRewardTest}
        bonusAfterEach={bonusAfterEach}
        normalTest={normalTest}
        normalQuestionType={normalQuestionType}
        quizWordButtonTest={quizWordButtonTest}
        quizCompletionTest={quizCompletionTest}
        quizFlowTest={quizFlowTest}
      />
    </section>
  );
}
