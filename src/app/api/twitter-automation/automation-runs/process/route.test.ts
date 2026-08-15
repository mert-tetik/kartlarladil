import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { fromMock, refreshAutomationRunStatusMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  refreshAutomationRunStatusMock: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-auth", () => ({
  hasSocialStudioSession: () => true,
}));

vi.mock("@/features/twitter-automation/automation-run-service", () => ({
  processAutomationOutput: vi.fn(),
  refreshAutomationRunStatus: refreshAutomationRunStatusMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: fromMock }),
}));

describe("automation browser video processing", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("records a browser video failure so the client queue can continue", async () => {
    const outputId = "7d13ccca-d537-4a5a-9a08-20df9c391007";
    const capturedUpdates: unknown[] = [];
    const candidate = {
      id: outputId,
      run_id: "a93bd43f-2ad1-4495-bf96-525302661da8",
      content_type: "video",
      generator: "music-ai-word-of-the-day",
      language: "en",
      native_language: "tr",
      tier: "A1",
      scheduled_at: "2026-08-15T09:00:00.000Z",
      target_account_ids: [],
      status: "awaiting_browser_video",
      caption: null,
      media_path: "automation/7d13ccca-d537-4a5a-9a08-20df9c391007.png",
      media_paths: [],
      media_type: "image",
      provider_task_id: null,
      upload_post_jobs: [],
    };
    const candidateQuery = {
      in: () => ({ order: () => ({ limit: () => ({ eq: () => ({ maybeSingle: async () => ({ data: candidate, error: null }) }) }) }) }),
    };
    const outputLookup = { select: () => candidateQuery };
    const runLookup = { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: candidate.run_id }, error: null }) }) }) }) };
    const outputUpdate = {
      update: (value: unknown) => {
        capturedUpdates.push(value);
        return { eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: { id: outputId }, error: null }) }) }) }) };
      },
    };
    let outputTableCallCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") {
        outputTableCallCount += 1;
        return outputTableCallCount === 1 ? outputLookup : outputUpdate;
      }
      if (table === "social_content_automation_runs") return runLookup;
      throw new Error(`Unexpected table: ${table}`);
    });
    refreshAutomationRunStatusMock.mockResolvedValue(undefined);

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs/process", {
      method: "POST",
      body: JSON.stringify({ outputId, browserVideoError: "audio_activation_required", scope: "test" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outputId, outcome: "failed" });
    expect(capturedUpdates).toEqual([expect.objectContaining({ status: "failed", error_code: "audio_activation_required" })]);
    expect(refreshAutomationRunStatusMock).toHaveBeenCalledWith(candidate.run_id);
  });
});
