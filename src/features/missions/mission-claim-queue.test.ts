import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClaimMissionRewardAction = vi.hoisted(() => vi.fn());

vi.mock("./mission-actions", () => ({
  claimMissionRewardAction: mockClaimMissionRewardAction,
}));

import {
  enqueueMissionClaim,
  resetMissionClaimQueueForTests,
} from "./mission-claim-queue";
import { useMissionClaimStore } from "./mission-claim-store";
import type { ClaimMissionResult } from "./mission-actions";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("mission claim queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetMissionClaimQueueForTests();
    useMissionClaimStore.setState({
      claimedIds: new Set(),
      pendingClaimIds: new Set(),
      pendingClaimOwnerId: null,
    });
  });

  it("queues later claims while the current reward is saving", async () => {
    const first = deferred<ClaimMissionResult>();
    const second = deferred<ClaimMissionResult>();
    mockClaimMissionRewardAction
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstClaim = enqueueMissionClaim("user-1", "mission-1");
    const secondClaim = enqueueMissionClaim("user-1", "mission-2");

    expect(mockClaimMissionRewardAction).toHaveBeenCalledTimes(1);
    expect(mockClaimMissionRewardAction).toHaveBeenCalledWith("mission-1", "user-1");
    expect(useMissionClaimStore.getState().pendingClaimIds).toEqual(new Set(["mission-1", "mission-2"]));

    first.resolve({ status: "success" });
    await expect(firstClaim).resolves.toEqual({ status: "success" });
    await vi.waitFor(() => {
      expect(mockClaimMissionRewardAction).toHaveBeenCalledWith("mission-2", "user-1");
    });

    second.resolve({ status: "success" });
    await expect(secondClaim).resolves.toEqual({ status: "success" });
    expect(useMissionClaimStore.getState().pendingClaimIds).toEqual(new Set());
    expect(useMissionClaimStore.getState().claimedIds).toEqual(new Set(["mission-1", "mission-2"]));
  });

  it("rolls back only the mission whose background save fails", async () => {
    mockClaimMissionRewardAction.mockResolvedValue({
      status: "error",
      message: "network_error",
    });

    await expect(enqueueMissionClaim("user-1", "mission-1")).resolves.toEqual({
      status: "error",
      message: "network_error",
    });

    expect(useMissionClaimStore.getState().pendingClaimIds).toEqual(new Set());
    expect(useMissionClaimStore.getState().claimedIds).toEqual(new Set());
  });

  it("keeps a reward claimed when a resumed request was already committed", async () => {
    mockClaimMissionRewardAction.mockResolvedValue({
      status: "error",
      message: "mission_already_claimed",
    });

    await expect(enqueueMissionClaim("user-1", "mission-1")).resolves.toEqual({ status: "success" });

    expect(useMissionClaimStore.getState().pendingClaimIds).toEqual(new Set());
    expect(useMissionClaimStore.getState().claimedIds).toEqual(new Set(["mission-1"]));
  });
});
