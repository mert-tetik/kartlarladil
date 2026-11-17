import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ensureUserProfile } from "@/features/auth/auth-session";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fox@example.com",
  user_metadata: { full_name: "X" },
} as unknown as User;

function makeSupabaseMock({
  readResult = { data: null, error: null },
  insertResult = {
    data: {
      display_name: "fox",
      preferred_language_code: "en",
      preferred_ui_locale: "en",
      preferred_tier: "A1",
      onboarding_completed: false,
    },
    error: null,
  },
}: {
  readResult?: { data: Record<string, unknown> | null; error: { code?: string; message?: string } | null };
  insertResult?: { data: Record<string, unknown> | null; error: { code?: string; message?: string } | null };
} = {}) {
  const insert = vi.fn(() => ({
    select: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue(insertResult) })),
  }));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue(readResult) })),
    })),
    insert,
  }));

  return { client: { from } as unknown as SupabaseClient, from, insert };
}

describe("ensureUserProfile", () => {
  it("uses a constraint-safe fallback name and reports successful creation", async () => {
    const { client, insert } = makeSupabaseMock();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    try {
      const result = await ensureUserProfile(client, user, { source: "client_session_recovery" });

      expect(result.available).toBe(true);
      expect(result.created).toBe(true);
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ display_name: "fox" }));
      expect(warn.mock.calls.flat().join(" ")).not.toContain("fox@example.com");
      expect(info.mock.calls.flat().join(" ")).not.toContain("fox@example.com");
    } finally {
      warn.mockRestore();
      info.mockRestore();
    }
  });

  it("does not mistake a profile-read failure for a missing row", async () => {
    const { client, insert } = makeSupabaseMock({
      readResult: { data: null, error: { code: "503", message: "temporary database error" } },
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const result = await ensureUserProfile(client, user);

      expect(result.available).toBe(false);
      expect(result.errorCode).toBe("503");
      expect(insert).not.toHaveBeenCalled();
      expect(errorLog.mock.calls.flat().join(" ")).not.toContain("fox@example.com");
    } finally {
      errorLog.mockRestore();
    }
  });

  it("records a categorized insert failure without logging the rejected value", async () => {
    const { client } = makeSupabaseMock({
      insertResult: { data: null, error: { code: "23514", message: "user_profiles_display_name_check" } },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const result = await ensureUserProfile(client, user);

      expect(result.available).toBe(false);
      expect(result.errorCode).toBe("23514");
      expect(errorLog.mock.calls.flat().join(" ")).toContain("check_constraint");
      expect(`${warn.mock.calls.flat().join(" ")} ${errorLog.mock.calls.flat().join(" ")}`).not.toContain("fox@example.com");
    } finally {
      warn.mockRestore();
      errorLog.mockRestore();
    }
  });
});
