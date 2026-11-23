import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/analytics/sessions/route";

const mocks = vi.hoisted(() => {
  const updateChain = {
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  updateChain.eq.mockReturnValue(updateChain);
  updateChain.is.mockReturnValue(updateChain);
  updateChain.select.mockReturnValue(updateChain);

  return {
    getCurrentAuthUser: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(() => updateChain),
    insert: vi.fn(),
    updateChain,
  };
});

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mocks.getCurrentAuthUser,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      upsert: mocks.upsert,
      update: mocks.update,
      insert: mocks.insert,
    }),
  }),
}));

function makeRequest(body: unknown) {
  return new Request("https://example.test/api/analytics/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const sessionId = "2a83694d-381a-48e9-b304-f9a3d3b04222";

describe("analytics sessions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAuthUser.mockResolvedValue({ id: "user-1" });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.updateChain.maybeSingle.mockResolvedValue({
      data: { session_id: sessionId },
      error: null,
    });
  });

  it("creates an account-owned session without blocking the user", async () => {
    const response = await POST(makeRequest({
      action: "start",
      session_id: sessionId,
      platform: "twa",
    }));

    expect(response.status).toBe(204);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      session_id: sessionId,
      user_id: "user-1",
      platform: "twa",
      started_at: expect.any(String),
      last_seen_at: expect.any(String),
    }), { onConflict: "session_id", ignoreDuplicates: true });
  });

  it("updates only the authenticated user's open session heartbeat", async () => {
    const response = await POST(makeRequest({
      action: "heartbeat",
      session_id: sessionId,
      platform: "twa",
    }));

    expect(response.status).toBe(204);
    expect(mocks.update).toHaveBeenCalledWith({ last_seen_at: expect.any(String) });
    expect(mocks.updateChain.eq).toHaveBeenCalledWith("session_id", sessionId);
    expect(mocks.updateChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.updateChain.is).toHaveBeenCalledWith("ended_at", null);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("closes a session and records why it ended", async () => {
    const response = await POST(makeRequest({
      action: "end",
      session_id: sessionId,
      platform: "twa",
      end_reason: "pagehide",
    }));

    expect(response.status).toBe(204);
    expect(mocks.update).toHaveBeenCalledWith({
      last_seen_at: expect.any(String),
      ended_at: expect.any(String),
      end_reason: "pagehide",
    });
  });

  it("creates a short session if the start request was lost before close", async () => {
    mocks.updateChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await POST(makeRequest({
      action: "end",
      session_id: sessionId,
      platform: "web",
      end_reason: "pagehide",
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      session_id: sessionId,
      user_id: "user-1",
      started_at: expect.any(String),
      last_seen_at: expect.any(String),
      ended_at: expect.any(String),
      end_reason: "pagehide",
    }));
  });

  it("silently ignores unauthenticated telemetry", async () => {
    mocks.getCurrentAuthUser.mockResolvedValue(null);

    const response = await POST(makeRequest({
      action: "heartbeat",
      session_id: sessionId,
      platform: "web",
    }));

    expect(response.status).toBe(204);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
