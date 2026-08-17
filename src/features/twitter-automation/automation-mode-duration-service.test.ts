import { afterEach, describe, expect, it, vi } from "vitest";
import { recordSuccessfulAutomationOutputDuration, type AutomationOutputRecord } from "@/features/twitter-automation/automation-run-service";

const { fromMock, rpcMock, updateMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

function output(overrides: Partial<AutomationOutputRecord> = {}): AutomationOutputRecord {
  return {
    id: "a2c6639d-8a03-421d-bfea-d13c73001cf3",
    run_id: "c2c6639d-8a03-421d-bfea-d13c73001cf3",
    content_type: "text",
    generator: "fun-post",
    language: "en",
    native_language: "tr",
    tier: "A1",
    scheduled_at: "2026-08-18T09:00:00.000Z",
    target_account_ids: [],
    status: "ready_to_schedule",
    caption: "Hazır içerik",
    media_path: null,
    media_paths: [],
    media_type: null,
    provider_task_id: null,
    upload_post_jobs: [],
    generation_attempt_started_at: "2026-08-18T08:59:40.000Z",
    ...overrides,
  };
}

describe("automation mode duration telemetry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("stores the elapsed duration only for a successful output", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T09:00:00.000Z"));
    rpcMock.mockResolvedValue({ data: true, error: null });

    await expect(recordSuccessfulAutomationOutputDuration(output())).resolves.toBe(true);

    expect(rpcMock).toHaveBeenCalledWith("record_social_content_automation_mode_duration", {
      p_duration_ms: 20_000,
      p_output_id: "a2c6639d-8a03-421d-bfea-d13c73001cf3",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("does not add waiting or failed outputs to the rolling average", async () => {
    await expect(recordSuccessfulAutomationOutputDuration(output({ status: "failed" }))).resolves.toBe(false);
    await expect(recordSuccessfulAutomationOutputDuration(output({ duration_recorded_at: "2026-08-18T09:00:00.000Z" }))).resolves.toBe(false);

    expect(rpcMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
