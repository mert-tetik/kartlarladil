"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChestOpeningView } from "@/features/quiz/components/chest-opening-view";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";

export default function LearnChestOpeningPreviewPage() {
  const [instance, setInstance] = useState(0);
  const [completed, setCompleted] = useState(false);

  return (
    <section className="fixed inset-0 bg-background" data-learn-page>
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-background p-4 sm:p-6">
        {completed ? (
          <Button
            onClick={() => {
              setCompleted(false);
              setInstance((current) => current + 1);
            }}
          >
            Replay chest reward
          </Button>
        ) : (
          <ChestOpeningView
            key={instance}
            tier={CHEST_TIERS[4]}
            totalPoints={1280}
            onComplete={() => setCompleted(true)}
          />
        )}
      </div>
    </section>
  );
}
