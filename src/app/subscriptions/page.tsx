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
    title: t("page.subscriptions.title"),
    description: t("page.subscriptions.description"),
    pathname: "/subscriptions",
  });
}

export default async function SubscriptionsPage() {
  const locale = await getServerLocale();
  const content = legalContent[locale === "tr" ? "tr" : "en"].subscriptions;

  return (
    <LegalPage
      titleKey="page.subscriptions.title"
      descriptionKey="page.subscriptions.description"
      lastUpdated={LEGAL_LAST_UPDATED}
    >
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </LegalPage>
  );
}
