import { POST } from "@/app/api/internal/push/send-inactivity/route";
import { vi } from "vitest";

const mockCreateSupabaseAdminClient = vi.hoisted(() => vi.fn());
const mockSendDueInactivityNotifications = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

vi.mock("@/features/push/push-server", () => ({
  sendDueInactivityNotifications: mockSendDueInactivityNotifications,
}));

describe("POST /api/internal/push/send-inactivity", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PUSH_CRON_SECRET = "secret";
    mockCreateSupabaseAdminClient.mockReturnValue({ from: vi.fn() });
    mockSendDueInactivityNotifications.mockResolvedValue({
      considered: 3,
      sent: 2,
      failed: 1,
      skipped: 0,
      deactivated: 1,
    });
  });

  it("rejects requests with an invalid cron secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/push/send-inactivity", {
        method: "POST",
        headers: {
          "x-push-cron-secret": "wrong",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(mockSendDueInactivityNotifications).not.toHaveBeenCalled();
  });

  it("sends notifications when the cron secret matches", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/push/send-inactivity", {
        method: "POST",
        headers: {
          "x-push-cron-secret": "secret",
        },
      }),
    );

    const payload = (await response.json()) as { sent: number };
    expect(response.status).toBe(200);
    expect(payload.sent).toBe(2);
    expect(mockSendDueInactivityNotifications).toHaveBeenCalledTimes(1);
  });
});
