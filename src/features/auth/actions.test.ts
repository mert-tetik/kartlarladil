import { deleteAccountAction } from "@/features/auth/actions";
import { DELETE_ACCOUNT_CONFIRMATION } from "@/features/auth/auth-schemas";
import { vi } from "vitest";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockDeleteUser = vi.hoisted(() => vi.fn());
const mockGetUserEntitlements = vi.hoisted(() => vi.fn());
const mockCreateSupabaseAdminClient = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/i18n/server", () => ({
  getServerLocale: vi.fn(() => Promise.resolve("en")),
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
        signOut: vi.fn(),
      },
    }),
  ),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

vi.mock("@/features/subscriptions/subscription-service", () => ({
  getUserEntitlements: mockGetUserEntitlements,
}));

function makeDeleteFormData() {
  const formData = new FormData();
  formData.set("confirmation", DELETE_ACCOUNT_CONFIRMATION);
  return formData;
}

describe("deleteAccountAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      error: null,
    });
    mockCreateSupabaseAdminClient.mockReturnValue({
      auth: {
        admin: {
          deleteUser: mockDeleteUser,
        },
      },
    });
  });

  it("blocks account deletion server-side when the user has an active paid subscription", async () => {
    mockGetUserEntitlements.mockResolvedValue({
      plan: "pro",
      effectivePlan: "pro",
      status: "active",
      provider: "lemon_squeezy",
      limits: {
        activeCards: null,
        learnedCards: null,
        aiDailyMessages: 150,
        aiMonthlyMessages: 4500,
      },
      customerPortalUrl: null,
    });

    const result = await deleteAccountAction({ status: "idle", message: "" }, makeDeleteFormData());

    expect(result.status).toBe("error");
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});
