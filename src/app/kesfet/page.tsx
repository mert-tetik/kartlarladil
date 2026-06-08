import { DiscoverWorkbench } from "@/features/cards/components/discover-workbench";
import { PageHeader } from "@/components/page-header";

export default function DiscoverPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Kart keşfet"
        description="Kelime ara, tier ve dil filtresi kullan veya rastgele kart çekerek hazneni büyüt."
      />
      <div className="mt-8">
        <DiscoverWorkbench />
      </div>
    </section>
  );
}
