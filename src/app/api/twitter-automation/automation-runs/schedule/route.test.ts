import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { describeFailureMock, fromMock, scheduleRunMock } = vi.hoisted(() => ({
  describeFailureMock: vi.fn(),
  fromMock: vi.fn(),
  scheduleRunMock: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-auth", () => ({
  hasSocialStudioSession: () => true,
}));

vi.mock("@/features/twitter-automation/automation-run-service", () => ({
  describeAutomationScheduleFailure: describeFailureMock,
  logAutomationRequestFailure: vi.fn(),
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
    scheduleRunMock.mockResolvedValue({ scheduled: 4, failed: 1, skipped: 2 });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/schedule", {
      method: "POST",
      body: JSON.stringify({ runId }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ scheduled: 4, failed: 1, skipped: 2 });
    expect(scheduleRunMock).toHaveBeenCalledWith(runId);
  });

  it("can retry scheduling one output without invoking the generation retry flow", async () => {
    const runId = "2d13ccca-d537-4a5a-9a08-20df9c391007";
    const outputId = "3d13ccca-d537-4a5a-9a08-20df9c391007";
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: runId }, error: null }) }) }) }),
    });
    scheduleRunMock.mockResolvedValue({ scheduled: 1, failed: 0, skipped: 0 });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/schedule", {
      method: "POST",
      body: JSON.stringify({ runId, outputId }),
    }));

    expect(response.status).toBe(200);
    expect(scheduleRunMock).toHaveBeenCalledWith(runId, { outputId });
  });

  it("returns a readable cause when scheduling fails before output processing", async () => {
    const runId = "2d13ccca-d537-4a5a-9a08-20df9c391007";
    const failure = new Error("automation_schedule_lock_failed");
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: runId }, error: null }) }) }) }),
    });
    scheduleRunMock.mockRejectedValue(failure);
    describeFailureMock.mockReturnValue({
      errorCode: "automation_schedule_lock_failed",
      errorDetail: "Schedule edilecek kayıtlar veritabanında kilitlenemedi. Biraz sonra tekrar dene.",
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/schedule", {
      method: "POST",
      body: JSON.stringify({ runId }),
    }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      errorCode: "automation_schedule_lock_failed",
      errorDetail: "Schedule edilecek kayıtlar veritabanında kilitlenemedi. Biraz sonra tekrar dene.",
    });
    expect(describeFailureMock).toHaveBeenCalledWith(failure);
  });
});
