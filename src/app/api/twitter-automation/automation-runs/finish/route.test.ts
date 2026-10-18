import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { rpcMock, refreshStatusMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  refreshStatusMock: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-auth", () => ({
  hasSocialStudioAutomationSession: () => true,
}));

vi.mock("@/features/twitter-automation/automation-run-service", () => ({
  refreshAutomationRunStatus: refreshStatusMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc: rpcMock }),
}));

const runId = "2d13ccca-d537-4a5a-9a08-20df9c391007";

describe("automation run lifecycle actions", () => {
  afterEach(() => vi.clearAllMocks());

  it("stops and skips unfinished output through the atomic database action", async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/finish", {
      method: "POST",
      body: JSON.stringify({ runId, action: "stop-generation", scope: "production" }),
    }));

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("stop_social_content_automation_generation", {
      p_owner_key: "social-studio",
      p_run_id: runId,
    });
    expect(refreshStatusMock).toHaveBeenCalledWith(runId, { autoSchedule: false });
  });

  it("marks the run complete only after the database confirms it is no longer generating", async () => {
    rpcMock.mockResolvedValue({ data: [{ finished: true, status: "completed" }], error: null });
    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/finish", {
      method: "POST",
      body: JSON.stringify({ runId, action: "finish" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ finished: true, status: "completed" });
    expect(rpcMock).toHaveBeenCalledWith("finish_social_content_automation_run", {
      p_owner_key: "social-studio",
      p_run_id: runId,
    });
  });

  it("does not allow finalizing a run with active output generation", async () => {
    rpcMock.mockResolvedValue({ data: [{ finished: false, status: null }], error: null });
    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/finish", {
      method: "POST",
      body: JSON.stringify({ runId, action: "finish" }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ errorCode: "automation_run_still_generating" });
  });
});
