import { PageHeader } from "@/components/page-header";
import { InventoryDashboard } from "@/features/inventory/components/inventory-dashboard";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";

export default async function LearnedPage() {
  await requireAuthUser("/learned");
  const t = createTranslator(await getServerLocale());

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader title={t("page.learned.title")} description={t("page.learned.description")} />
      <div className="mt-8">
        <InventoryDashboard learnedOnly />
      </div>
      <div id="alistirma" className="mt-12">
        <PageHeader title={t("page.learned.practiceTitle")} description={t("page.learned.practiceDescription")} />
        <div className="mt-8">
          <QuizStation mode="learned" />
        </div>
      </div>
    </section>
  );
}
