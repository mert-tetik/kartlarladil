import { PageHeader } from "@/components/page-header";
import { CardDrawWorkbench } from "@/features/cards/components/card-draw-workbench";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";

export default async function CardDrawPage() {
  const t = createTranslator(await getServerLocale());

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={t("page.cardDraw.title")} description={t("page.cardDraw.description")} />
      <div className="mt-8">
        <CardDrawWorkbench />
      </div>
    </section>
  );
}
