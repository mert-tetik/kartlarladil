import { afterEach, describe, expect, it, vi } from "vitest";

const { eqMock, fromMock, maybeSingleMock, rpcMock, selectMock, upsertMock } = vi.hoisted(() => ({
  eqMock: vi.fn(),
  fromMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  rpcMock: vi.fn(),
  selectMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: fromMock, rpc: rpcMock }),
}));

import {
  isSocialStudioPoyoCircuitOpen,
  recordSocialStudioPoyoRetryableFailure,
  recordSocialStudioPoyoSuccess,
} from "@/features/twitter-automation/social-studio-provider-health";

describe("Social Studio PoYo provider health", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reads an active circuit only from the service-role health record", async () => {
    maybeSingleMock.mockResolvedValue({ data: { open_until: "2026-08-21T12:05:00.000Z" }, error: null });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });

    await expect(isSocialStudioPoyoCircuitOpen(Date.parse("2026-08-21T12:00:00.000Z"))).resolves.toBe(true);
    expect(fromMock).toHaveBeenCalledWith("social_content_automation_provider_health");
    expect(eqMock).toHaveBeenCalledWith("provider_name", "poyo_responses");
  });

  it("records retryable failures through the protected RPC", async () => {
    rpcMock.mockResolvedValue({ error: null });

    await expect(recordSocialStudioPoyoRetryableFailure()).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith("record_social_content_automation_provider_failure", {
      p_circuit_open_seconds: 300,
      p_failure_window_seconds: 120,
      p_provider_name: "poyo_responses",
    });
  });

  it("clears the failure count after a successful PoYo response", async () => {
    upsertMock.mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ upsert: upsertMock });

    await expect(recordSocialStudioPoyoSuccess()).resolves.toBeUndefined();
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      consecutive_failures: 0,
      last_failure_at: null,
      open_until: null,
      provider_name: "poyo_responses",
    }), { onConflict: "provider_name" });
  });

  it("surfaces a storage failure so the fallback wrapper can fail open", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: new Error("Supabase unavailable") });
    eqMock.mockReturnValue({ maybeSingle: maybeSingleMock });
    selectMock.mockReturnValue({ eq: eqMock });
    fromMock.mockReturnValue({ select: selectMock });

    await expect(isSocialStudioPoyoCircuitOpen()).rejects.toThrow("social_studio_provider_health_read_failed");
  });
});
