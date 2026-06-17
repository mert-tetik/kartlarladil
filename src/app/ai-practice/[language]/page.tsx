import { redirect } from "next/navigation";
import { isLanguageCode } from "@/data/languages";
import { requireAuthUser } from "@/features/auth/auth-session";
import { AiPracticeTierSelection } from "@/features/ai-practice/components/ai-practice-tier-selection";

type AiPracticeTierPageProps = {
  params: Promise<{ language: string }>;
};

export default async function AiPracticeTierPage({ params }: AiPracticeTierPageProps) {
  const { language: rawLanguage } = await params;

  if (!isLanguageCode(rawLanguage)) {
    redirect("/ai-practice");
  }

  await requireAuthUser(`/ai-practice/${rawLanguage}`);

  return (
    <section className="mx-auto flex min-h-full w-full max-w-7xl flex-col items-center justify-center px-4 py-6 max-lg:py-4 sm:px-6 lg:px-8">
      <AiPracticeTierSelection language={rawLanguage} />
    </section>
  );
}
