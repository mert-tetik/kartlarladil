import type { Metadata } from "next";
import { CardDrawWorkbench } from "@/features/cards/components/card-draw-workbench";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("page.cardDraw.title"),
    description: t("page.cardDraw.description"),
    pathname: "/card-draw",
  });
}

export default async function CardDrawPage() {
  return (
    <section
      className="animate-screen-pop mx-auto h-full max-w-7xl px-4 py-10 max-lg:px-0 max-lg:py-0 sm:px-6 lg:px-8"
      data-card-draw-page
    >
      <CardDrawWorkbench />
    </section>
  );
}
