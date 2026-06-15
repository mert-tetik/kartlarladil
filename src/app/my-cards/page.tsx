import { PageHeader } from "@/components/page-header";
import { InventoryDashboard } from "@/features/inventory/components/inventory-dashboard";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";

export default async function MyCardsPage() {
  await requireAuthUser("/my-cards");
  const t = createTranslator(await getServerLocale());

  return (
    <section
      className="mx-auto max-w-7xl px-4 py-10 max-lg:px-0 max-lg:py-0 sm:px-6 lg:px-8"
      data-my-cards-page
    >
      <div className="max-lg:hidden">
        <PageHeader title={t("page.inventory.title")} description={t("page.inventory.description")} />
      </div>
      <div className="mt-8 max-lg:mt-0">
        <InventoryDashboard mobileSheet />
      </div>
    </section>
  );
}
