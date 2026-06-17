import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import type { ReactNode } from "react";

interface LegalPageProps {
  titleKey: "page.terms.title" | "page.privacy.title" | "page.refund.title" | "page.cookies.title" | "page.subscriptions.title";
  descriptionKey:
    | "page.terms.description"
    | "page.privacy.description"
    | "page.refund.description"
    | "page.cookies.description"
    | "page.subscriptions.description";
  lastUpdated: string;
  children: ReactNode;
}

export async function LegalPage({ titleKey, descriptionKey, lastUpdated, children }: LegalPageProps) {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-semibold text-foreground">{t(titleKey)}</h1>
      <p className="mt-2 text-foreground-secondary">{t(descriptionKey)}</p>
      <div className="mt-8 [&_h2]:mt-8 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:mb-4 [&_p]:leading-7 [&_p]:text-foreground-secondary [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-2 [&_li]:text-foreground-secondary [&_a]:font-semibold [&_a]:text-foreground [&_a]:underline [&_a]:hover:no-underline [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
      <p className="mt-12 text-sm text-foreground-muted">
        {t("legal.lastUpdated")}: {lastUpdated}
      </p>
    </main>
  );
}
