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
      className="mx-auto max-w-7xl px-4 py-10 max-lg:px-4 max-lg:py-4 sm:px-6 lg:px-8"
      data-my-cards-page
    >
      <PageHeader
        title={t("page.inventory.title")}
        mascot="/mascots/mascot10.png"
      />
      <div className="mt-8 max-lg:mt-4">
        <InventoryDashboard />
      </div>
    </section>
  );
}
