import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/analytics/events/route";

const mocks = vi.hoisted(() => ({
  getCurrentAuthUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mocks.getCurrentAuthUser,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ insert: mocks.insert }),
  }),
}));

describe("analytics events route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAuthUser.mockResolvedValue({ id: "user-1" });
    mocks.insert.mockResolvedValue({ error: null });
  });

  it("records a tutorial completion for the authenticated session", async () => {
    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({ event_name: "tutorial_completed" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      event_name: "tutorial_completed",
      properties: {},
    });
  });

  it("records the tutorial card-add method", async () => {
    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({
        event_name: "tutorial_card_add_method_selected",
        properties: { method: "group" },
      }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      event_name: "tutorial_card_add_method_selected",
      properties: { method: "group" },
    });
  });

  it("records cards added during the tutorial with the selected method", async () => {
    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({
        event_name: "tutorial_cards_added",
        properties: { method: "group", added_count: 12 },
      }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      event_name: "tutorial_cards_added",
      properties: { method: "group", added_count: 12 },
    });
  });

  it("ignores tutorial card-add totals without a valid count or method", async () => {
    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({
        event_name: "tutorial_cards_added",
        properties: { method: "groups", added_count: 0 },
      }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("ignores a tutorial card-add method event without a valid method", async () => {
    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({
        event_name: "tutorial_card_add_method_selected",
        properties: { method: "groups" },
      }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each([
    "pricing_page_viewed",
    "pricing_subscription_details_opened",
    "onboarding_completed",
    "app_opened",
    "first_card_added",
    "first_quiz_completed",
    "first_card_learned",
    "learn_session_completed",
    "subscription_purchase_started",
    "subscription_purchase_succeeded",
    "subscription_purchase_failed",
    "subscription_purchase_cancelled",
    "subscription_restored",
    "subscription_restore_failed",
  ] as const)("records %s for the authenticated session", async (eventName) => {
    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({ event_name: eventName }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      event_name: eventName,
      properties: {},
    });
  });

  it("records funnel properties without exposing client identity", async () => {
    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({
        event_name: "subscription_purchase_succeeded",
        properties: {
          source: "restriction",
          plan: "basic",
          billing_cycle: "monthly",
          restriction_code: "free_active_card_limit",
          effective_plan: "basic",
        },
      }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      event_name: "subscription_purchase_succeeded",
      properties: {
        source: "restriction",
        plan: "basic",
        billing_cycle: "monthly",
        restriction_code: "free_active_card_limit",
        effective_plan: "basic",
      },
    });
  });

  it.each([
    "subscription_restriction_opened",
    "subscription_restriction_details_opened",
  ] as const)("records %s with its restriction code", async (eventName) => {
    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({
        event_name: eventName,
        properties: { restriction_code: "free_active_card_limit" },
      }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      event_name: eventName,
      properties: { restriction_code: "free_active_card_limit" },
    });
  });

  it("rejects a restriction event without its restriction code", async () => {
    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({ event_name: "subscription_restriction_opened" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("does not trust or store a client-supplied user id", async () => {
    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({ event_name: "tutorial_completed", user_id: "attacker" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("treats duplicate tutorial beacons as successful no-ops", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });

    const response = await POST(new Request("https://example.test/api/analytics/events", {
      method: "POST",
      body: JSON.stringify({ event_name: "tutorial_completed" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(204);
  });
});
