"use client";

import { useState } from "react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { CelebrationView } from "@/features/quiz/components/quiz-station";

const PREVIEW_CARD = VOCABULARY_CARDS.find((card) => card.tier === "A1") ?? VOCABULARY_CARDS[0];

export default function LearnCardCelebrationPreviewPage() {
  const [completed, setCompleted] = useState(false);

  if (!PREVIEW_CARD) {
    return null;
  }

  return (
    <section className="fixed inset-0 bg-background" data-learn-page>
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-background p-4 sm:p-6">
        {completed ? (
          <div
            className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground"
            data-card-celebration-preview-complete
          />
        ) : (
          <CelebrationView
            card={PREVIEW_CARD}
            basePoints={120}
            onContinue={() => setCompleted(true)}
          />
        )}
      </div>
    </section>
  );
}
