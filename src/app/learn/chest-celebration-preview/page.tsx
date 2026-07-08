"use client";

import { ChestCelebrationView } from "@/features/quiz/components/chest-celebration-view";

export default function LearnChestCelebrationPreviewPage() {
  return (
    <section className="fixed inset-0 bg-background" data-learn-page>
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-background p-4 sm:p-6">
        <ChestCelebrationView onComplete={() => {}} />
      </div>
    </section>
  );
}
