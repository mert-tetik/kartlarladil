import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH, POST } from "@/app/api/analytics/performance/route";
import { PERFORMANCE_DIAGNOSTICS_POLICY_VERSION } from "@/lib/performance-diagnostics-contract";

const mocks = vi.hoisted(() => ({
  getCurrentAuthUser: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
  deleteEq: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mocks.getCurrentAuthUser,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
      upsert: mocks.upsert,
      delete: () => ({ eq: mocks.deleteEq }),
    }),
    rpc: mocks.rpc,
  }),
}));

function makeRequest(method: string, body?: unknown) {
  return new Request("https://example.test/api/analytics/performance", {
    method,
    ...(body === undefined ? {} : {
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
}

const validDevice = {
  manufacturer: "Google",
  model: "Pixel 7",
  android_release: "16",
  android_api_level: 36,
  app_version: "4.3.75 (189)",
  webview_package: "com.google.android.webview",
  webview_version: "140.0.7339.0",
};

describe("performance diagnostics route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAuthUser.mockResolvedValue({ id: "user-1" });
    mocks.maybeSingle.mockResolvedValue({
      data: { enabled: true, policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION },
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.deleteEq.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("returns automatic diagnostics state for the authenticated account", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enabled: true,
      has_decided: true,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    });
  });

  it("keeps diagnostics enabled without a settings row", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enabled: true,
      has_decided: true,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    });
  });

  it("keeps the legacy consent endpoint automatic for cached clients", async () => {
    const response = await PATCH(makeRequest("PATCH", {
      enabled: false,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enabled: true,
      has_decided: true,
      policy_version: PERFORMANCE_DIAGNOSTICS_POLICY_VERSION,
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.deleteEq).not.toHaveBeenCalled();
  });

  it("accepts diagnostics without a prior consent row", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { enabled: false }, error: null });
    const response = await POST(makeRequest("POST", {
      events: [{
        event_id: "2a83694d-381a-48e9-b304-f9a3d3b04222",
        captured_at: new Date().toISOString(),
        device: validDevice,
        startup_ms: 5_200,
        startup_stage_ms: { webview_setup_ms: 230 },
      }],
    }));

    expect(response.status).toBe(204);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("validates and stores high-water measurements using the session user", async () => {
    const response = await POST(makeRequest("POST", {
      events: [{
        event_id: "2a83694d-381a-48e9-b304-f9a3d3b04222",
        captured_at: new Date().toISOString(),
        device: validDevice,
        startup_ms: 5_200,
        startup_stage_ms: { webview_setup_ms: 230, profile_bootstrap_ms: 1_800 },
      }],
    }));

    expect(response.status).toBe(204);
    expect(mocks.rpc).toHaveBeenCalledWith("record_user_performance_diagnostic", expect.objectContaining({
      p_user_id: "user-1",
      p_event_id: "2a83694d-381a-48e9-b304-f9a3d3b04222",
      p_device: validDevice,
      p_metrics: {
        startup_ms: 5_200,
        startup_stage_ms: { webview_setup_ms: 230, profile_bootstrap_ms: 1_800 },
      },
    }));
    const [, parameters] = mocks.rpc.mock.calls[0];
    expect(parameters.p_environment_key).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects user-supplied identity and unexpected metric fields", async () => {
    const response = await POST(makeRequest("POST", {
      user_id: "attacker",
      events: [{
        event_id: "2a83694d-381a-48e9-b304-f9a3d3b04222",
        captured_at: new Date().toISOString(),
        device: validDevice,
        startup_ms: 5_200,
        user_email: "private@example.test",
      }],
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects oversized request bodies before processing measurements", async () => {
    const response = await POST(new Request("https://example.test/api/analytics/performance", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "30001" },
      body: "{}",
    }));

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
