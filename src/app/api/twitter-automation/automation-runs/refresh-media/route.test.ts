import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { fromMock, refreshMediaMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  refreshMediaMock: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-auth", () => ({
  hasSocialStudioSession: () => true,
}));

vi.mock("@/features/twitter-automation/automation-run-service", () => ({
  refreshAutomationOutputMediaPreviews: refreshMediaMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: fromMock }),
}));

describe("automation generated-media refresh", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes only an owned run and returns the media verification result", async () => {
    const runId = "2d13ccca-d537-4a5a-9a08-20df9c391007";
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: runId }, error: null }) }) }) }),
    });
    refreshMediaMock.mockResolvedValue({ checked: 3, invalid: 1 });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/refresh-media", {
      method: "POST",
      body: JSON.stringify({ runId, scope: "test" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checked: 3, invalid: 1 });
    expect(refreshMediaMock).toHaveBeenCalledWith(runId);
  });

  it("does not refresh a run outside the current automation scope", async () => {
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/refresh-media", {
      method: "POST",
      body: JSON.stringify({ runId: "3d13ccca-d537-4a5a-9a08-20df9c391007" }),
    }));

    expect(response.status).toBe(404);
    expect(refreshMediaMock).not.toHaveBeenCalled();
  });
});
