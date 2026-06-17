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
    title: t("page.terms.title"),
    description: t("page.terms.description"),
    pathname: "/terms",
  });
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
