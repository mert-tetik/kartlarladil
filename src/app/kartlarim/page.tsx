import { InventoryDashboard } from "@/features/inventory/components/inventory-dashboard";
import { PageHeader } from "@/components/page-header";

export default function MyCardsPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Kartlarım"
        description="Envanterin dillere ayrılır. Öğreniliyor ve öğrenildi durumları otomatik quiz ilerlemesiyle güncellenir."
      />
      <div className="mt-8">
        <InventoryDashboard />
      </div>
    </section>
  );
}
