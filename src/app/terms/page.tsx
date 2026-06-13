import type { Metadata } from "next";
import { LegalPage } from "@/features/legal/components/legal-page";
import { legalContent, LEGAL_LAST_UPDATED } from "@/features/legal/content";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { APP_NAME } from "@/lib/constants";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return {
    title: `${t("page.terms.title")} | ${APP_NAME}`,
    description: t("page.terms.description"),
  };
}

export default async function TermsPage() {
  const locale = await getServerLocale();
  const content = legalContent[locale === "tr" ? "tr" : "en"].terms;

  return (
    <LegalPage titleKey="page.terms.title" descriptionKey="page.terms.description" lastUpdated={LEGAL_LAST_UPDATED}>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </LegalPage>
  );
}
