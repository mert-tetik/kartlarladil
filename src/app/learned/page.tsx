import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { InventoryDashboard } from "@/features/inventory/components/inventory-dashboard";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("page.learned.title"),
    description: t("page.learned.description"),
    pathname: "/learned",
    noIndex: true,
  });
}

export default async function LearnedPage() {
  await requireAuthUser("/learned");
  const t = createTranslator(await getServerLocale());

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={t("page.learned.title")} description={t("page.learned.description")} />
      <div className="mt-8">
        <InventoryDashboard learnedOnly />
      </div>
    </section>
  );
}
