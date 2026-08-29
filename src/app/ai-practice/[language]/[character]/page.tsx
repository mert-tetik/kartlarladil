import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLanguageCode } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import {
  getAiPracticeCharacter,
  getCharacterName,
  getRandomOpeningLine,
} from "@/features/ai-practice/ai-practice-data";
import { getAiPracticeScenario, getScenarioOpeningLine, getScenarioTitle } from "@/features/ai-practice/ai-practice-scenarios";
import { AiPracticeChatPanel } from "@/features/ai-practice/components/ai-practice-chat-panel";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getLanguageDisplayName } from "@/i18n/labels";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import type { Tier } from "@/types/domain";

type AiPracticeChatPageProps = {
  params: Promise<{ language: string; character: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: AiPracticeChatPageProps): Promise<Metadata> {
  const { language: rawLanguage, character: characterId } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const languageName = isLanguageCode(rawLanguage) ? getLanguageDisplayName(rawLanguage, locale) : undefined;
  const character = getAiPracticeCharacter(characterId);
  const scenario = character ? null : getAiPracticeScenario(characterId);
  const resolvedCharacter = character ?? (scenario ? getAiPracticeCharacter(scenario.characterId) : null);
  const characterName =
    resolvedCharacter && isLanguageCode(rawLanguage) ? getCharacterName(resolvedCharacter, rawLanguage) : undefined;

  return buildMetadata({
    locale,
    title: scenario && characterName
      ? `${getScenarioTitle(scenario, locale)} - ${languageName ?? t("page.aiPractice.title")}`
      : characterName
      ? `${characterName} — ${languageName ?? t("page.aiPractice.title")}`
      : t("page.aiPractice.title"),
    description: t("page.aiPractice.description"),
    pathname: `/ai-practice/${rawLanguage}/${characterId}`,
    noIndex: true,
  });
}

export default async function AiPracticeChatPage({ params, searchParams }: AiPracticeChatPageProps) {
  const { language: rawLanguage, character: characterId } = await params;

  if (!isLanguageCode(rawLanguage)) {
    redirect("/ai-practice");
  }

  await requireAuthUser(`/ai-practice/${rawLanguage}/${characterId}`);

  const rawSearchParams = await searchParams;
  const isScenarioMode = rawSearchParams.mode === "scenario";
  const scenario = isScenarioMode ? getAiPracticeScenario(characterId) : null;
  const character = scenario
    ? getAiPracticeCharacter(scenario.characterId)
    : getAiPracticeCharacter(characterId);

  if (isScenarioMode && !scenario) {
    redirect(`/ai-practice/${rawLanguage}`);
  }

  if (!character) {
    redirect(`/ai-practice/${rawLanguage}`);
  }

  const { tier: rawTier } = rawSearchParams;
  const tier: Tier =
    typeof rawTier === "string" && (TIERS as readonly string[]).includes(rawTier) ? (rawTier as Tier) : "A1";
  const initialOpeningLine = scenario
    ? getScenarioOpeningLine(scenario, rawLanguage)
    : getRandomOpeningLine(character, rawLanguage);

  return (
    <section className="h-full w-full px-0 py-0" data-ai-practice-chat-page>
      <AiPracticeChatPanel
        character={character}
        initialOpeningLine={initialOpeningLine}
        language={rawLanguage}
        tier={tier}
        scenario={scenario ?? undefined}
      />
    </section>
  );
}
