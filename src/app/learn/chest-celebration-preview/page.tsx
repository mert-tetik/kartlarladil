"use client";

import { ChestCelebrationView } from "@/features/quiz/components/chest-celebration-view";

export default function LearnChestCelebrationPreviewPage() {
  return (
    <section
      className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-7xl flex-col justify-center px-4 py-10 max-lg:h-[calc(100dvh-var(--mobile-nav-bar-height))] max-lg:w-full max-lg:max-w-none max-lg:overflow-hidden max-lg:px-0 max-lg:py-0 lg:px-8"
      data-learn-page
    >
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-center bg-background p-4 max-lg:bottom-[var(--mobile-nav-bar-height)] max-lg:top-[var(--app-header-height)] max-lg:p-0 lg:bottom-0 lg:top-16">
        <ChestCelebrationView onComplete={() => {}} />
      </div>
    </section>
  );
}
