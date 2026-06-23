import type { Metadata } from "next";
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

  return (
    <section
      className="animate-screen-pop mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col px-4 py-10 max-lg:h-[calc(100dvh-8rem)] max-lg:min-h-0 max-lg:px-4 max-lg:pt-4 max-lg:pb-0 sm:px-6 lg:px-8"
      data-my-cards-page
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <InventoryDashboard showHeader />
      </div>
    </section>
  );
}
