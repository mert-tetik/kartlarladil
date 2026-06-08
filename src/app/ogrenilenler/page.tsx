import { InventoryDashboard } from "@/features/inventory/components/inventory-dashboard";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import { PageHeader } from "@/components/page-header";

export default function LearnedPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Öğrenilen kartlar"
        description="Tamamlanan kartlarını incele ve kalıcılığı artırmak için tekrar alıştırması yap."
      />
      <div className="mt-8">
        <InventoryDashboard learnedOnly />
      </div>
      <div id="alistirma" className="mt-12">
        <PageHeader
          title="Tekrar alıştırması"
          description="Öğrenilmiş kartlar ilerleme kaybetmeden tekrar edilir."
        />
        <div className="mt-8">
          <QuizStation mode="learned" />
        </div>
      </div>
    </section>
  );
}
