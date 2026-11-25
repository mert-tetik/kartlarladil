import { describe, expect, it } from "vitest";
import {
  isInventorySnapshotSafeForSession,
  shouldClearInventoryForSession,
} from "@/features/inventory/inventory-session-cache";

describe("isInventorySnapshotSafeForSession", () => {
  it("waits until the auth identity is resolved", () => {
    expect(isInventorySnapshotSafeForSession({
      sessionReady: false,
      userId: null,
      ownerUserId: "user-1",
      hasInventoryCards: true,
    })).toBe(false);
  });

  it("allows a warm cache belonging to the signed-in user before cloud refresh", () => {
    expect(isInventorySnapshotSafeForSession({
      sessionReady: true,
      userId: "user-1",
      ownerUserId: "user-1",
      hasInventoryCards: true,
    })).toBe(true);
  });

  it("does not expose another account's cached inventory", () => {
    expect(isInventorySnapshotSafeForSession({
      sessionReady: true,
      userId: "user-2",
      ownerUserId: "user-1",
      hasInventoryCards: true,
    })).toBe(false);
  });

  it("allows guest inventory to be migrated into a newly signed-in account", () => {
    expect(isInventorySnapshotSafeForSession({
      sessionReady: true,
      userId: "user-1",
      ownerUserId: null,
      hasInventoryCards: true,
    })).toBe(true);
  });

  it("allows guest inventory only for a confirmed guest session", () => {
    expect(isInventorySnapshotSafeForSession({
      sessionReady: true,
      userId: null,
      ownerUserId: null,
      hasInventoryCards: false,
    })).toBe(true);
  });
});

describe("shouldClearInventoryForSession", () => {
  it("preserves the account cache while auth is still restoring the session", () => {
    expect(shouldClearInventoryForSession({
      sessionReady: false,
      userId: null,
      ownerUserId: "user-1",
    })).toBe(false);
  });

  it("clears account data only after a signed-out session is confirmed", () => {
    expect(shouldClearInventoryForSession({
      sessionReady: true,
      userId: null,
      ownerUserId: "user-1",
    })).toBe(true);
  });
});
