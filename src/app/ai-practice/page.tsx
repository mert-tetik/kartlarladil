import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("page.aiPractice.title"),
    description: t("page.aiPractice.description"),
    pathname: "/ai-practice",
    noIndex: true,
  });
}

export default async function AiPracticePage() {
  const user = await requireAuthUser("/ai-practice");
  const preferredLanguage = user.profile.preferredLanguageCode ?? "en";

  redirect(`/ai-practice/${preferredLanguage}/character`);
}
