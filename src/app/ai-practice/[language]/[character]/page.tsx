import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLanguageCode } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { getAiPracticeCharacter, getCharacterName } from "@/features/ai-practice/ai-practice-data";
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
  const characterName =
    character && isLanguageCode(rawLanguage) ? getCharacterName(character, rawLanguage) : undefined;

  return buildMetadata({
    locale,
    title: characterName
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

  const character = getAiPracticeCharacter(characterId);

  if (!character) {
    redirect(`/ai-practice/${rawLanguage}`);
  }

  const { tier: rawTier } = await searchParams;
  const tier: Tier =
    typeof rawTier === "string" && (TIERS as readonly string[]).includes(rawTier) ? (rawTier as Tier) : "A1";

  return (
    <section className="animate-screen-pop mx-auto max-w-7xl px-4 py-6 max-lg:px-0 max-lg:py-0 sm:px-6 lg:px-8">
      <AiPracticeChatPanel character={character} language={rawLanguage} tier={tier} />
    </section>
  );
}
