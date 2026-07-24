"use client";

import { createPortal } from "react-dom";
import { ChestCelebrationView } from "@/features/quiz/components/chest-celebration-view";
import { useIsClient } from "@/lib/use-is-client";

export default function LearnChestCelebrationPreviewPage() {
  const mounted = useIsClient();

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <section className="fixed inset-0 z-[100] bg-background" data-learn-page>
      <div
        className="fixed inset-0 flex items-center justify-center bg-background p-0"
        data-quiz-overlay="chest"
      >
        <ChestCelebrationView onComplete={() => {}} />
      </div>
    </section>,
    document.body,
  );
}
