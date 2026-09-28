"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MissionsPanel } from "./missions-panel";

export function MissionTestScreen({ seed }: { seed: number }) {
  const [open, setOpen] = useState(true);

  return (
    <section
      data-mission-test-page
      className="min-h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] bg-background p-4"
    >
      {!open ? (
        <Button type="button" onClick={() => setOpen(true)}>
          Open missions test
        </Button>
      ) : null}

      <MissionsPanel
        open={open}
        onClose={() => setOpen(false)}
        testMode
        testSeed={seed}
      />
    </section>
  );
}
