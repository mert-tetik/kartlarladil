import { POST } from "@/app/api/push/open/route";
import { vi } from "vitest";

const mockGetCurrentAuthUser = vi.hoisted(() => vi.fn());
const mockVerifyPushOpenToken = vi.hoisted(() => vi.fn());
const mockCreateSupabaseAdminClient = vi.hoisted(() => vi.fn());
const mockCreateSupabaseServerClient = vi.hoisted(() => vi.fn());
const mockAdminUpdate = vi.hoisted(() => vi.fn());
const mockServerUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mockGetCurrentAuthUser,
}));

vi.mock("@/features/push/push-server", () => ({
  verifyPushOpenToken: mockVerifyPushOpenToken,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

function createUpdateChain() {
  const chain = {
    error: null,
    eq: vi.fn(),
  };

  chain.eq.mockReturnValue(chain);
  return chain;
}

describe("POST /api/push/open", () => {
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
      },
    });

    mockAdminUpdate.mockReturnValue(createUpdateChain());
    mockServerUpdate.mockReturnValue(createUpdateChain());

    mockCreateSupabaseAdminClient.mockReturnValue({
      from: () => ({
        update: mockAdminUpdate,
      }),
    });

    mockCreateSupabaseServerClient.mockResolvedValue({
      from: () => ({
        update: mockServerUpdate,
      }),
    });
  });

  it("uses the signed token path when the token is valid", async () => {
    mockVerifyPushOpenToken.mockReturnValue(true);

    const response = await POST(
      new Request("http://localhost/api/push/open", {
        method: "POST",
        body: JSON.stringify({
          logId: "550e8400-e29b-41d4-a716-446655440000",
          token: "signed-token",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockAdminUpdate).toHaveBeenCalled();
    expect(mockServerUpdate).not.toHaveBeenCalled();
  });

  it("requires auth when there is no valid signed token", async () => {
    mockVerifyPushOpenToken.mockReturnValue(false);
    mockGetCurrentAuthUser.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/push/open", {
        method: "POST",
        body: JSON.stringify({
          logId: "550e8400-e29b-41d4-a716-446655440000",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });
});
