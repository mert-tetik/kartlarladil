import { redirect } from "next/navigation";
import { isLanguageCode } from "@/data/languages";
import { AskChatPanel } from "@/features/ask/components/ask-chat-panel";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";

type AskPageProps = {
  params: Promise<{ language: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: AskPageProps) {
  const { language: rawLanguage } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return {
    title: isLanguageCode(rawLanguage) ? `${t("page.ask.title")} | FoxiesDeck` : "FoxiesDeck",
  };
}

export default async function AskPage({ params, searchParams }: AskPageProps) {
  const { language: rawLanguage } = await params;

  const locale = await getServerLocale();

  if (!isLanguageCode(rawLanguage)) {
    redirect(`/ask/${locale}`);
  }

  await requireAuthUser(`/ask/${rawLanguage}`);

  const { term: rawTerm } = await searchParams;
  const initialTerm = typeof rawTerm === "string" ? rawTerm.trim() : "";

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <AskChatPanel language={rawLanguage} initialTerm={initialTerm} />
    </section>
  );
}
