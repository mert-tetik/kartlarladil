import { QuizStation } from "@/features/quiz/components/quiz-station";
import { PageHeader } from "@/components/page-header";

export default function LearnPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title="Kartları öğren"
        description="Aktif kartların çevirisini bil. Tier eşiği tamamlandığında kart otomatik öğrenildi olur."
      />
      <div className="mt-8">
        <QuizStation mode="active" />
      </div>
    </section>
  );
}
