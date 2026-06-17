import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/components/legal-page";
import { legalContent, LEGAL_LAST_UPDATED } from "@/features/legal/content";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("page.cookies.title"),
    description: t("page.cookies.description"),
    pathname: "/cookies",
  });
}

export default async function CookiesPage() {
  const locale = await getServerLocale();
  const content = legalContent[locale === "tr" ? "tr" : "en"].cookies;

  return (
    <LegalPage titleKey="page.cookies.title" descriptionKey="page.cookies.description" lastUpdated={LEGAL_LAST_UPDATED}>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </LegalPage>
  );
}
