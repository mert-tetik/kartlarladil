"use client";

import { sendTwaAnalyticsEvent } from "@/lib/twa-analytics";

const POINT_MILESTONE_EVENTS = [
  { points: 100, eventName: "fd_points_100_reached" },
  { points: 200, eventName: "fd_points_200_reached" },
  { points: 500, eventName: "fd_points_500_reached" },
  { points: 1000, eventName: "fd_points_1000_reached" },
] as const;

export function trackPointMilestones(previousPoints: number, nextPoints: number): void {
  if (nextPoints <= previousPoints) {
    return;
  }

  for (const milestone of POINT_MILESTONE_EVENTS) {
    if (previousPoints < milestone.points && nextPoints >= milestone.points) {
      sendTwaAnalyticsEvent(milestone.eventName, {
        params: {
          points: milestone.points,
          total_points: nextPoints,
        },
      });
    }
  }
}

export function isFirstLearnedTransition(previousStatus: string, nextStatus: string): boolean {
  return previousStatus !== "learned" && nextStatus === "learned";
}
