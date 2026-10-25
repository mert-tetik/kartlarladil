import { updateThemeAction } from "@/features/themes/actions";
import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAuthUser: vi.fn(),
  getUserEntitlementsOrNull: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mocks.getCurrentAuthUser,
}));
vi.mock("@/features/subscriptions/subscription-service", () => ({
  getUserEntitlementsOrNull: mocks.getUserEntitlementsOrNull,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

describe("updateThemeAction", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getCurrentAuthUser.mockResolvedValue({ id: "user-1" });
    mocks.getUserEntitlementsOrNull.mockResolvedValue({ effectivePlan: "pro" });
    mocks.eq.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.createSupabaseAdminClient.mockReturnValue({ from: mocks.from });
  });

  it("writes a paid theme through the admin client only after checking the current user", async () => {
    const result = await updateThemeAction("ocean-dark");

    expect(result).toEqual({ status: "success" });
    expect(mocks.getUserEntitlementsOrNull).toHaveBeenCalledWith("user-1");
    expect(mocks.createSupabaseAdminClient).toHaveBeenCalledOnce();
    expect(mocks.from).toHaveBeenCalledWith("user_profiles");
    expect(mocks.update).toHaveBeenCalledWith({ theme: "ocean-dark" });
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/");
  });

  it("rejects free users before creating the admin client", async () => {
    mocks.getUserEntitlementsOrNull.mockResolvedValue({ effectivePlan: "free" });

    const result = await updateThemeAction("ocean-dark");

    expect(result).toEqual({ status: "error", code: "free_plan" });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("fails closed and does not write when entitlements are unavailable", async () => {
    mocks.getUserEntitlementsOrNull.mockResolvedValue(null);

    const result = await updateThemeAction("ocean-dark");

    expect(result).toEqual({ status: "error", code: "unknown" });
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
