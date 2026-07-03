import { DELETE, POST } from "@/app/api/push/subscriptions/route";
import { vi } from "vitest";

const mockGetCurrentAuthUser = vi.hoisted(() => vi.fn());
const mockCreateSupabaseAdminClient = vi.hoisted(() => vi.fn());
const mockPushSubscriptionsUpsert = vi.hoisted(() => vi.fn());
const mockPushSubscriptionsUpdate = vi.hoisted(() => vi.fn());
const mockUserProfilesUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mockGetCurrentAuthUser,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

function createUpdateChain() {
  const chain = {
    error: null,
    eq: vi.fn(),
  };

  chain.eq.mockReturnValue(chain);
  return chain;
}

describe("push subscription routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetCurrentAuthUser.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      profile: {
        displayName: "Test",
        preferredLanguageCode: "en",
        preferredUiLocale: "en",
        preferredTier: "A1",
        onboardingCompleted: true,
        aiPracticePoints: 0,
        chestPoints: 0,
        pushMarketingEnabled: false,
      },
    });

    const pushUpdateChain = createUpdateChain();
    const profileUpdateChain = createUpdateChain();
    mockPushSubscriptionsUpdate.mockReturnValue(pushUpdateChain);
    mockUserProfilesUpdate.mockReturnValue(profileUpdateChain);
    mockPushSubscriptionsUpsert.mockResolvedValue({ error: null });

    mockCreateSupabaseAdminClient.mockReturnValue({
      from: (table: string) => {
        if (table === "push_subscriptions") {
          return {
            upsert: mockPushSubscriptionsUpsert,
            update: mockPushSubscriptionsUpdate,
          };
        }

        return {
          update: mockUserProfilesUpdate,
        };
      },
    });
  });

  it("requires authentication for subscription upserts", async () => {
    mockGetCurrentAuthUser.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/push/subscriptions", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
  });

  it("upserts the current user's subscription and enables marketing", async () => {
    const response = await POST(
      new Request("http://localhost/api/push/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          subscription: {
            endpoint: "https://example.com/push",
            expirationTime: null,
            keys: {
              auth: "auth",
              p256dh: "p256dh",
            },
          },
          permission_state: "granted",
          app_surface: "twa_android",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPushSubscriptionsUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        endpoint: "https://example.com/push",
        permission_state: "granted",
      }),
      { onConflict: "endpoint" },
    );
    expect(mockUserProfilesUpdate).toHaveBeenCalledWith({ push_marketing_enabled: true });
  });

  it("deactivates push subscriptions and disables marketing on delete", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/push/subscriptions", {
        method: "DELETE",
        body: JSON.stringify({
          endpoint: "https://example.com/push",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockPushSubscriptionsUpdate).toHaveBeenCalledWith({
      is_active: false,
      cooldown_until: null,
    });
    expect(mockUserProfilesUpdate).toHaveBeenCalledWith({ push_marketing_enabled: false });
  });
});
