import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { fromMock, refreshRunMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  refreshRunMock: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-auth", () => ({
  hasSocialStudioSession: () => true,
}));

vi.mock("@/features/twitter-automation/automation-run-service", () => ({
  refreshAutomationRunStatus: refreshRunMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: fromMock }),
}));

describe("automation output retry", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requeues a failed generation and clears its prior error", async () => {
    const outputLookup = {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: {
          id: "5d13ccca-d537-4a5a-9a08-20df9c391007",
          run_id: "6d13ccca-d537-4a5a-9a08-20df9c391007",
          status: "failed",
          caption: null,
          media_path: null,
          media_paths: [],
          media_type: null,
        },
        error: null,
      }) }) }),
    };
    const runLookup = {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "6d13ccca-d537-4a5a-9a08-20df9c391007" }, error: null }) }) }) }),
    };
    const updateMock = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") return { ...outputLookup, update: updateMock };
      if (table === "social_content_automation_runs") return runLookup;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/retry", {
      method: "POST",
      body: JSON.stringify({ outputId: "5d13ccca-d537-4a5a-9a08-20df9c391007", scope: "test" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "queued" });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: "queued",
      error_code: null,
      media_path: null,
      provider_task_id: null,
    }));
    expect(refreshRunMock).toHaveBeenCalledWith("6d13ccca-d537-4a5a-9a08-20df9c391007");
  });

  it("restores an already-rendered failed output to the scheduling state", async () => {
    const outputLookup = {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: {
          id: "7d13ccca-d537-4a5a-9a08-20df9c391007",
          run_id: "8d13ccca-d537-4a5a-9a08-20df9c391007",
          status: "failed",
          caption: "Hazır içerik",
          media_path: "automation/7d13ccca-d537-4a5a-9a08-20df9c391007.png",
          media_paths: [],
          media_type: "image",
        },
        error: null,
      }) }) }),
    };
    const runLookup = {
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "8d13ccca-d537-4a5a-9a08-20df9c391007" }, error: null }) }) }) }),
    };
    const updateMock = vi.fn(() => ({ eq: () => ({ eq: async () => ({ error: null }) }) }));
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") return { ...outputLookup, update: updateMock };
      if (table === "social_content_automation_runs") return runLookup;
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/retry", {
      method: "POST",
      body: JSON.stringify({ outputId: "7d13ccca-d537-4a5a-9a08-20df9c391007" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ready_to_schedule" });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "ready_to_schedule", error_code: null }));
    expect(updateMock).not.toHaveBeenCalledWith(expect.objectContaining({ media_path: null }));
  });
});
