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
    title: t("page.inventory.title"),
    description: t("page.inventory.description"),
    pathname: "/my-cards",
    noIndex: true,
  });
}

export default async function MyCardsPage() {
  await requireAuthUser("/my-cards");
  const t = createTranslator(await getServerLocale());

  return (
    <section
      className="animate-screen-pop mx-auto flex max-w-7xl flex-col px-4 py-10 max-lg:h-[calc(100dvh-8rem)] max-lg:px-4 max-lg:py-0 sm:px-6 lg:px-8"
      data-my-cards-page
    >
      <PageHeader
        title={t("page.inventory.title")}
        mascot="/mascots/mascot10.png"
        mascotSize="2xl"
        className="max-lg:hidden"
      />
      <div className="mt-8 flex-1 max-lg:mt-2">
        <InventoryDashboard />
      </div>
    </section>
  );
}
