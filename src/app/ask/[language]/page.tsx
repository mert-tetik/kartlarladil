import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLanguageCode } from "@/data/languages";
import { AskChatPanel } from "@/features/ask/components/ask-chat-panel";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { getLanguageDisplayName } from "@/i18n/labels";
import { buildMetadata } from "@/lib/seo/metadata";

type AskPageProps = {
  params: Promise<{ language: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: AskPageProps): Promise<Metadata> {
  const { language: rawLanguage } = await params;
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const languageName = isLanguageCode(rawLanguage) ? getLanguageDisplayName(rawLanguage, locale) : undefined;

  return buildMetadata({
    locale,
    title: languageName ? `${t("page.ask.title")} — ${languageName}` : t("page.ask.title"),
    description: t("page.ask.description"),
    pathname: `/ask/${rawLanguage}`,
    noIndex: true,
  });
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
    <section className="animate-screen-pop mx-auto max-w-7xl px-4 py-6 max-lg:px-0 max-lg:py-0 sm:px-6 lg:px-8">
      <AskChatPanel language={rawLanguage} initialTerm={initialTerm} />
    </section>
  );
}
