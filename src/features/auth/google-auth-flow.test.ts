import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearGoogleAuthPending,
  getGoogleAuthPendingStartedAt,
  GOOGLE_AUTH_PENDING_EVENT,
  GOOGLE_AUTH_PENDING_STORAGE_KEY,
  GOOGLE_AUTH_PENDING_TIMEOUT_MS,
  markGoogleAuthPending,
} from "./google-auth-flow";

describe("google auth pending flow", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not recursively emit a change when no pending marker exists", () => {
    let changeCount = 0;
    const readOnChange = () => {
      changeCount += 1;
      if (changeCount <= 10) getGoogleAuthPendingStartedAt();
    };

    window.addEventListener(GOOGLE_AUTH_PENDING_EVENT, readOnChange);
    try {
      expect(getGoogleAuthPendingStartedAt()).toBeNull();
      expect(changeCount).toBe(0);
    } finally {
      window.removeEventListener(GOOGLE_AUTH_PENDING_EVENT, readOnChange);
    }
  });

  it("notifies once when clearing an existing marker and is then idempotent", () => {
    const onChange = vi.fn();
    window.addEventListener(GOOGLE_AUTH_PENDING_EVENT, onChange);

    try {
      markGoogleAuthPending();
      clearGoogleAuthPending();
      clearGoogleAuthPending();

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(window.sessionStorage.getItem(GOOGLE_AUTH_PENDING_STORAGE_KEY)).toBeNull();
    } finally {
      window.removeEventListener(GOOGLE_AUTH_PENDING_EVENT, onChange);
    }
  });

  it("clears an invalid stored marker without re-entering the change listener", () => {
    window.sessionStorage.setItem(GOOGLE_AUTH_PENDING_STORAGE_KEY, "invalid");
    let changeCount = 0;
    const readOnChange = () => {
      changeCount += 1;
      getGoogleAuthPendingStartedAt();
    };
    window.addEventListener(GOOGLE_AUTH_PENDING_EVENT, readOnChange);

    try {
      expect(getGoogleAuthPendingStartedAt()).toBeNull();
      expect(changeCount).toBe(1);
    } finally {
      window.removeEventListener(GOOGLE_AUTH_PENDING_EVENT, readOnChange);
    }
  });

  it("clears an expired marker with one notification", () => {
    window.sessionStorage.setItem(
      GOOGLE_AUTH_PENDING_STORAGE_KEY,
      String(Date.now() - GOOGLE_AUTH_PENDING_TIMEOUT_MS - 1),
    );
    let changeCount = 0;
    const readOnChange = () => {
      changeCount += 1;
      getGoogleAuthPendingStartedAt();
    };
    window.addEventListener(GOOGLE_AUTH_PENDING_EVENT, readOnChange);

    try {
      expect(getGoogleAuthPendingStartedAt()).toBeNull();
      expect(changeCount).toBe(1);
    } finally {
      window.removeEventListener(GOOGLE_AUTH_PENDING_EVENT, readOnChange);
    }
  });
});
