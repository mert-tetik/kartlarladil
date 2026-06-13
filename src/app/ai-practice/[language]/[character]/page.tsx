import { redirect } from "next/navigation";
import { isLanguageCode } from "@/data/languages";
import { getAiPracticeCharacter } from "@/features/ai-practice/ai-practice-data";
import { AiPracticeChatPanel } from "@/features/ai-practice/components/ai-practice-chat-panel";
import { requireAuthUser } from "@/features/auth/auth-session";

type AiPracticeChatPageProps = {
  params: Promise<{ language: string; character: string }>;
};

export default async function AiPracticeChatPage({ params }: AiPracticeChatPageProps) {
  const { language: rawLanguage, character: characterId } = await params;

  if (!isLanguageCode(rawLanguage)) {
    redirect("/ai-practice");
  }

  await requireAuthUser(`/ai-practice/${rawLanguage}/${characterId}`);

  const character = getAiPracticeCharacter(characterId);

  if (!character) {
    redirect(`/ai-practice/${rawLanguage}`);
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <AiPracticeChatPanel character={character} language={rawLanguage} />
    </section>
  );
}
