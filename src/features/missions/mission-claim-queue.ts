"use client";

import { claimMissionRewardAction, type ClaimMissionResult } from "./mission-actions";
import { useMissionClaimStore } from "./mission-claim-store";

interface QueuedMissionClaim {
  userId: string;
  missionId: string;
  resolve: (result: ClaimMissionResult) => void;
}

const queuedClaims: QueuedMissionClaim[] = [];
const queuedPromises = new Map<string, Promise<ClaimMissionResult>>();
let processing = false;

function normalizeClaimResult(result: ClaimMissionResult): ClaimMissionResult {
  // A previous request may have committed immediately before a page reload.
  // Treat its idempotent response as complete rather than undoing the local reward state.
  if (result.status === "error" && result.message === "mission_already_claimed") {
    return { status: "success" };
  }

  return result;
}

async function processQueue() {
  if (processing) return;

  processing = true;

  while (queuedClaims.length > 0) {
    const task = queuedClaims.shift();
    if (!task) continue;

    let result: ClaimMissionResult;
    try {
      result = normalizeClaimResult(await claimMissionRewardAction(task.missionId, task.userId));
    } catch {
      result = { status: "error", message: "unknown_error" };
    }

    const store = useMissionClaimStore.getState();
    if (result.status === "success") {
      store.resolvePendingClaim(task.missionId, task.userId);
    } else {
      store.rejectPendingClaim(task.missionId, task.userId);
    }

    queuedPromises.delete(toTaskKey(task.userId, task.missionId));
    task.resolve(result);
  }

  processing = false;
}

function toTaskKey(userId: string, missionId: string) {
  return `${userId}:${missionId}`;
}

export function enqueueMissionClaim(userId: string, missionId: string): Promise<ClaimMissionResult> {
  const taskKey = toTaskKey(userId, missionId);
  const existing = queuedPromises.get(taskKey);
  if (existing) return existing;

  useMissionClaimStore.getState().markClaimPending(missionId, userId);

  const claim = new Promise<ClaimMissionResult>((resolve) => {
    queuedClaims.push({ userId, missionId, resolve });
  });
  queuedPromises.set(taskKey, claim);
  void processQueue();

  return claim;
}

export function resumePendingMissionClaims(userId: string, missionIds: Iterable<string>) {
  for (const missionId of missionIds) {
    void enqueueMissionClaim(userId, missionId);
  }
}

export function resetMissionClaimQueueForTests() {
  queuedClaims.splice(0, queuedClaims.length);
  queuedPromises.clear();
  processing = false;
}
