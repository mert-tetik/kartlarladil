import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { fromMock, scheduleRunMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  scheduleRunMock: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-auth", () => ({
  hasSocialStudioSession: () => true,
}));

vi.mock("@/features/twitter-automation/automation-run-service", () => ({
  scheduleReadyAutomationRun: scheduleRunMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: fromMock }),
}));

describe("automation run scheduling", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps TEST runs server-side locked even if the client bypasses its disabled button", async () => {
    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/schedule", {
      method: "POST",
      body: JSON.stringify({ runId: "1d13ccca-d537-4a5a-9a08-20df9c391007", scope: "test" }),
    }));

    expect(response.status).toBe(403);
    expect(scheduleRunMock).not.toHaveBeenCalled();
  });

  it("schedules only a production run owned by the current automation scope", async () => {
    const runId = "2d13ccca-d537-4a5a-9a08-20df9c391007";
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: runId }, error: null }) }) }) }),
    });
    scheduleRunMock.mockResolvedValue({ scheduled: 4, failed: 1 });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/schedule", {
      method: "POST",
      body: JSON.stringify({ runId }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scheduled: 4, failed: 1 });
    expect(scheduleRunMock).toHaveBeenCalledWith(runId);
  });
});
