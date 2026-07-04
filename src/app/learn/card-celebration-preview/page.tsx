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
    <section
      className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col justify-center px-4 py-10 max-lg:h-[calc(100dvh-var(--mobile-nav-bar-height))] max-lg:w-full max-lg:max-w-none max-lg:overflow-hidden max-lg:px-0 max-lg:py-0 lg:px-8"
      data-learn-page
    >
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-center bg-background p-4 max-lg:bottom-[var(--mobile-nav-bar-height)] max-lg:top-[var(--app-header-height)] max-lg:p-0 lg:bottom-0 lg:top-16">
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
