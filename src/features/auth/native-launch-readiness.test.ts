import { describe, expect, it } from "vitest";
import { isNativeLaunchDataReady } from "@/features/auth/native-launch-readiness";

const readyUserInput = {
  isSessionReady: true,
  userId: "user-1",
  inventoryHydrated: true,
  cloudEnabled: true,
  cloudLoading: false,
  cloudLoadComplete: true,
  ownerUserId: "user-1",
};

describe("isNativeLaunchDataReady", () => {
  it("waits for auth restoration before releasing native launch", () => {
    expect(isNativeLaunchDataReady({ ...readyUserInput, isSessionReady: false })).toBe(false);
  });

  it("waits for the signed-in user's inventory request to settle", () => {
    expect(isNativeLaunchDataReady({ ...readyUserInput, cloudLoading: true })).toBe(false);
    expect(isNativeLaunchDataReady({ ...readyUserInput, cloudLoadComplete: false })).toBe(false);
    expect(isNativeLaunchDataReady({ ...readyUserInput, cloudEnabled: false })).toBe(false);
  });

  it("releases a signed-in user after inventory loading settles", () => {
    expect(isNativeLaunchDataReady(readyUserInput)).toBe(true);
  });

  it("does not expose inventory belonging to another user", () => {
    expect(isNativeLaunchDataReady({ ...readyUserInput, ownerUserId: "user-2" })).toBe(false);
  });

  it("waits for guest inventory hydration before selecting the day's cards", () => {
    expect(isNativeLaunchDataReady({ ...readyUserInput, userId: null, inventoryHydrated: false })).toBe(false);
    expect(isNativeLaunchDataReady({ ...readyUserInput, userId: null })).toBe(true);
  });
});
