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
    title: `${t("page.refund.title")} | ${APP_NAME}`,
    description: t("page.refund.description"),
  };
}

export default async function RefundPage() {
  const locale = await getServerLocale();
  const content = legalContent[locale === "tr" ? "tr" : "en"].refund;

  return (
    <LegalPage titleKey="page.refund.title" descriptionKey="page.refund.description" lastUpdated={LEGAL_LAST_UPDATED}>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </LegalPage>
  );
}
