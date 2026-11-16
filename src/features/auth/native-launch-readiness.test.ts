import { describe, expect, it } from "vitest";
import { isNativeLaunchDataReady } from "@/features/auth/native-launch-readiness";

const readyUserInput = {
  isSessionReady: true,
  userId: "user-1",
  inventoryHydrated: true,
  ownerUserId: "user-1",
};

describe("isNativeLaunchDataReady", () => {
  it("waits for auth restoration before releasing native launch", () => {
    expect(isNativeLaunchDataReady({ ...readyUserInput, isSessionReady: false })).toBe(false);
  });

  it("releases a signed-in user from their own local snapshot while cloud refresh is pending", () => {
    expect(isNativeLaunchDataReady(readyUserInput)).toBe(true);
  });

  it("does not expose inventory belonging to another user", () => {
    expect(isNativeLaunchDataReady({ ...readyUserInput, ownerUserId: "user-2" })).toBe(false);
  });

  it("allows a new account with no owner-tagged local snapshot to load the cloud in background", () => {
    expect(isNativeLaunchDataReady({ ...readyUserInput, ownerUserId: null })).toBe(true);
  });

  it("waits for guest inventory hydration before selecting the day's cards", () => {
    expect(isNativeLaunchDataReady({ ...readyUserInput, userId: null, inventoryHydrated: false })).toBe(false);
    expect(isNativeLaunchDataReady({ ...readyUserInput, userId: null })).toBe(true);
  });
});
