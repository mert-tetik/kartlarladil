import { CardDrawWorkbench } from "@/features/cards/components/card-draw-workbench";

export default async function CardDrawPage() {
  return (
    <section
      className="animate-screen-pop mx-auto max-w-7xl px-4 py-10 max-lg:px-0 max-lg:py-0 sm:px-6 lg:px-8"
      data-card-draw-page
    >
      <CardDrawWorkbench />
    </section>
  );
}
