import { describe, expect, it, vi } from "vitest";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { scanAuthProfileHealth } from "@/features/auth/profile-health-service";

function makeAdminMock({ failProfiles = false } = {}) {
  const users = [
    { id: "00000000-0000-4000-8000-000000000001", created_at: "2026-11-18T10:00:00.000Z" },
    { id: "00000000-0000-4000-8000-000000000002", created_at: "2026-11-01T10:00:00.000Z" },
  ];
  const listUsers = vi.fn().mockResolvedValue({ data: { users, total: users.length }, error: null });
  const range = vi.fn().mockResolvedValue({
    data: failProfiles ? null : [{ user_id: users[1].id }],
    error: failProfiles ? { code: "503" } : null,
  });
  const client = {
    auth: { admin: { listUsers } },
    from: vi.fn(() => ({ select: vi.fn(() => ({ order: vi.fn(() => ({ range })) })) })),
  } as unknown as ReturnType<typeof createSupabaseAdminClient>;

  return { client, listUsers, range };
}

describe("scanAuthProfileHealth", () => {
  it("counts missing profiles by account age and only returns opaque fingerprints", async () => {
    const { client } = makeAdminMock();
    const report = await scanAuthProfileHealth(client, new Date("2026-11-18T12:00:00.000Z"));

    expect(report.authUsers).toBe(2);
    expect(report.profiles).toBe(1);
    expect(report.missingProfiles).toBe(1);
    expect(report.actionableMissingProfiles).toBe(1);
    expect(report.pendingWithinGracePeriod).toBe(0);
    expect(report.missingCreatedWithin24Hours).toBe(1);
    expect(report.missingCreatedWithin7Days).toBe(1);
    expect(report.sampleFingerprints).toHaveLength(1);
    expect(report.sampleFingerprints[0]).not.toContain("00000000");
  });

  it("treats a just-created account as pending during the 15-minute bootstrap grace period", async () => {
    const { client } = makeAdminMock();
    const report = await scanAuthProfileHealth(client, new Date("2026-11-18T10:05:00.000Z"));

    expect(report.missingProfiles).toBe(1);
    expect(report.actionableMissingProfiles).toBe(0);
    expect(report.pendingWithinGracePeriod).toBe(1);
    expect(report.sampleFingerprints).toHaveLength(0);
  });

  it("fails the scan instead of reporting a false clean state when profile reading fails", async () => {
    const { client } = makeAdminMock({ failProfiles: true });

    await expect(scanAuthProfileHealth(client)).rejects.toThrow("user_profiles_read_failed");
  });
});
