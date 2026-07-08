"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MissionRewardOverlay } from "@/features/missions/components/mission-reward-overlay";
import { CHEST_TIERS } from "@/features/quiz/chest-rewards";

type RewardMode =
  | { kind: "chest"; tier: (typeof CHEST_TIERS)[number] }
  | { kind: "points"; amount: number }
  | null;

export default function LearnMissionRewardPreviewPage() {
  const [mode, setMode] = useState<RewardMode>({ kind: "points", amount: 175 });

  return (
    <section className="fixed inset-0 bg-background" data-learn-page>
      <div className="fixed inset-0 flex items-center justify-center bg-background p-4 sm:p-6">
        {mode ? null : (
          <div className="flex flex-col gap-3">
            <Button onClick={() => setMode({ kind: "points", amount: 175 })}>
              Replay mission points
            </Button>
            <Button onClick={() => setMode({ kind: "chest", tier: CHEST_TIERS[5] })} variant="secondary">
              Replay mission chest
            </Button>
          </div>
        )}
      </div>

      <MissionRewardOverlay
        mode={mode}
        onComplete={() => setMode(null)}
      />
    </section>
  );
}
