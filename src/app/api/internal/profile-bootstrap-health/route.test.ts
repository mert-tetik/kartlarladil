import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/internal/profile-bootstrap-health/route";
import { scanAuthProfileHealth } from "@/features/auth/profile-health-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

vi.mock("@/features/auth/profile-health-service", () => ({ scanAuthProfileHealth: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const originalCronSecret = process.env.CRON_SECRET;
const cleanReport = {
  scannedAt: "2026-11-18T12:00:00.000Z",
  authUsers: 100,
  profiles: 100,
  missingProfiles: 0,
  actionableMissingProfiles: 0,
  pendingWithinGracePeriod: 0,
  missingCreatedWithin24Hours: 0,
  missingCreatedWithin7Days: 0,
  sampleFingerprints: [],
};

afterEach(() => {
  vi.clearAllMocks();
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

describe("GET /api/internal/profile-bootstrap-health", () => {
  it("requires the Vercel cron bearer token", async () => {
    process.env.CRON_SECRET = "test-cron-secret";

    const response = await GET(new NextRequest("https://example.test/api/internal/profile-bootstrap-health"));

    expect(response.status).toBe(403);
    expect(scanAuthProfileHealth).not.toHaveBeenCalled();
  });

  it("returns an error health status when old missing profiles are found", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    vi.mocked(createSupabaseAdminClient).mockReturnValue({} as never);
    vi.mocked(scanAuthProfileHealth).mockResolvedValue({
      ...cleanReport,
      missingProfiles: 1,
      actionableMissingProfiles: 1,
      missingCreatedWithin24Hours: 1,
      missingCreatedWithin7Days: 1,
      sampleFingerprints: ["opaque-fingerprint"],
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const response = await GET(new NextRequest("https://example.test/api/internal/profile-bootstrap-health", {
        headers: { authorization: "Bearer test-cron-secret" },
      }));

      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ healthy: false, actionableMissingProfiles: 1 });
      expect(errorLog.mock.calls.flat().join(" ")).toContain("profile_health_scan_found_missing_profiles");
    } finally {
      errorLog.mockRestore();
    }
  });

  it("treats a successful clean scan as healthy", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    vi.mocked(createSupabaseAdminClient).mockReturnValue({} as never);
    vi.mocked(scanAuthProfileHealth).mockResolvedValue(cleanReport);

    const response = await GET(new NextRequest("https://example.test/api/internal/profile-bootstrap-health", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ healthy: true, missingProfiles: 0 });
  });
});
