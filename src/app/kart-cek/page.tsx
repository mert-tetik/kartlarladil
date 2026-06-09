import { CardDrawWorkbench } from "@/features/cards/components/card-draw-workbench";
import { PageHeader } from "@/components/page-header";

export default function CardDrawPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Kart çek"
        description="Kelime ara, tier ve dil filtresi kullan veya rastgele kart çekerek hazneni büyüt."
      />
      <div className="mt-8">
        <CardDrawWorkbench />
      </div>
    </section>
  );
}
