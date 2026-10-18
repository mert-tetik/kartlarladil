import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/twitter-automation/maintenance/route";
import { cleanupAllAutomationRunData } from "@/features/twitter-automation/automation-maintenance-service";

vi.mock("@/features/twitter-automation/automation-maintenance-service", () => ({
  cleanupAllAutomationRunData: vi.fn(),
}));

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  vi.clearAllMocks();
  if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalCronSecret;
});

describe("GET /api/twitter-automation/maintenance", () => {
  it("rejects requests without the configured cron bearer token", async () => {
    process.env.CRON_SECRET = "test-secret";

    const response = await GET(new NextRequest("http://localhost/api/twitter-automation/maintenance"));

    expect(response.status).toBe(403);
    expect(cleanupAllAutomationRunData).not.toHaveBeenCalled();
  });

  it("runs the full media and run purge for an authorized cron request", async () => {
    process.env.CRON_SECRET = "test-secret";
    vi.mocked(cleanupAllAutomationRunData).mockResolvedValue({
      deletedRuns: 3,
      deletedOutputs: 12,
      removedMedia: 8,
    });

    const response = await GET(new NextRequest("http://localhost/api/twitter-automation/maintenance", {
      headers: { authorization: "Bearer test-secret" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletedRuns: 3, deletedOutputs: 12, removedMedia: 8 });
    expect(cleanupAllAutomationRunData).toHaveBeenCalledOnce();
  });
});
