import {
  deleteAccountAction,
  updateLanguagePreferenceAction,
  updateMobileLoginLanguagePreferencesAction,
} from "@/features/auth/actions";
import { DELETE_ACCOUNT_CONFIRMATION } from "@/features/auth/auth-schemas";
import { vi } from "vitest";

const mockGetUser = vi.hoisted(() => vi.fn());
const mockDeleteUser = vi.hoisted(() => vi.fn());
const mockGetUserEntitlements = vi.hoisted(() => vi.fn());
const mockCreateSupabaseAdminClient = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockEq = vi.hoisted(() => vi.fn());

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
      from: mockFrom,
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
      provider: "google_play",
      limits: {
        activeCards: null,
        learnedCards: null,
        aiDailyMessages: null,
        aiMonthlyMessages: null,
      },
      customerPortalUrl: null,
    });

    const result = await deleteAccountAction({ status: "idle", message: "" }, makeDeleteFormData());

    expect(result.status).toBe("error");
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });
});

describe("updateLanguagePreferenceAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      error: null,
    });
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it("updates only the stored UI locale", async () => {
    await updateLanguagePreferenceAction({
      field: "preferred_ui_locale",
      value: "de",
    });

    expect(mockFrom).toHaveBeenCalledWith("user_profiles");
    expect(mockUpdate).toHaveBeenCalledWith({ preferred_ui_locale: "de" });
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("updates only the stored learning language", async () => {
    await updateLanguagePreferenceAction({
      field: "preferred_language_code",
      value: "tr",
    });

    expect(mockFrom).toHaveBeenCalledWith("user_profiles");
    expect(mockUpdate).toHaveBeenCalledWith({ preferred_language_code: "tr" });
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("ignores unsupported preference values", async () => {
    await updateLanguagePreferenceAction({
      field: "preferred_ui_locale",
      value: "not-a-locale",
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("ignores unsupported preference fields", async () => {
    await updateLanguagePreferenceAction({
      field: "theme",
      value: "ocean",
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("updateMobileLoginLanguagePreferencesAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      error: null,
    });
    mockEq.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });
  });

  it("updates both languages but leaves avatar, tier, and onboarding state untouched", async () => {
    const formData = new FormData();
    formData.set("preferredUiLocale", "de");
    formData.set("preferredLanguageCode", "ja");

    const result = await updateMobileLoginLanguagePreferencesAction(
      { status: "idle", message: "" },
      formData,
    );

    expect(result.status).toBe("success");
    expect(mockFrom).toHaveBeenCalledWith("user_profiles");
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const update = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(update).sort()).toEqual([
      "preferred_language_code",
      "preferred_ui_locale",
      "updated_at",
    ]);
    expect(update).toMatchObject({
      preferred_language_code: "ja",
      preferred_ui_locale: "de",
    });
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("rejects matching native and learning languages before touching Supabase", async () => {
    const formData = new FormData();
    formData.set("preferredUiLocale", "en");
    formData.set("preferredLanguageCode", "en");

    const result = await updateMobileLoginLanguagePreferencesAction(
      { status: "idle", message: "" },
      formData,
    );

    expect(result.status).toBe("error");
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
