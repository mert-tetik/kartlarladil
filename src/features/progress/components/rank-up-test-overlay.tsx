"use client";

import { useEffect, useState } from "react";
import { RankProgressPopover } from "@/features/progress/components/rank-progress-popover";
import { EMPTY_PROGRESS_STATS, RANKS, getNextRankProgress } from "@/features/progress/progress-stats";

const MOBILE_BREAKPOINT = 1024;
const TEST_POINTS = RANKS[4]?.minPoints ?? 0;
const TEST_STATS = {
  ...EMPTY_PROGRESS_STATS,
  totalPoints: TEST_POINTS,
  ...getNextRankProgress(TEST_POINTS),
};

export function RankUpTestOverlay() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requested = params.get("rank-up-test") === "1" || params.get("rank-up-test") === "true";
    setEnabled(requested && window.innerWidth < MOBILE_BREAKPOINT);
  }, []);

  if (!enabled) {
    return null;
  }

  return <RankProgressPopover stats={TEST_STATS} hideTrigger forceRankUpRank={TEST_STATS.rank} />;
}
