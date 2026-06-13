import { PageHeader } from "@/components/page-header";
import { InventoryDashboard } from "@/features/inventory/components/inventory-dashboard";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";

export default async function MyCardsPage() {
  const t = createTranslator(await getServerLocale());

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={t("page.inventory.title")} description={t("page.inventory.description")} />
      <div className="mt-8">
        <InventoryDashboard />
      </div>
    </section>
  );
}
