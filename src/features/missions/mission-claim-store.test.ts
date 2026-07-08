import { describe, expect, it, beforeEach } from "vitest";
import { useMissionClaimStore } from "./mission-claim-store";

const STORAGE_KEY = "foxiesdeck:missions:claimed";

describe("useMissionClaimStore", () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY);
    useMissionClaimStore.setState({ claimedIds: new Set() });
  });

  it("starts with an empty set", () => {
    expect(useMissionClaimStore.getState().claimedIds.size).toBe(0);
  });

  it("marks a mission as claimed", () => {
    useMissionClaimStore.getState().markClaimed("mission_1");
    expect(useMissionClaimStore.getState().claimedIds.has("mission_1")).toBe(true);
  });

  it("replaces the claimed id set", () => {
    useMissionClaimStore.getState().setClaimedIds(["a", "b", "c"]);
    expect(useMissionClaimStore.getState().claimedIds.size).toBe(3);
    expect(useMissionClaimStore.getState().claimedIds.has("b")).toBe(true);
  });

  it("clears the claimed id set", () => {
    useMissionClaimStore.getState().setClaimedIds(["a", "b"]);
    useMissionClaimStore.getState().clearClaimed();
    expect(useMissionClaimStore.getState().claimedIds.size).toBe(0);
  });

  it("persists claimed ids to localStorage", () => {
    useMissionClaimStore.getState().markClaimed("mission_persist");

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.state.claimedIds).toContain("mission_persist");
  });
});
