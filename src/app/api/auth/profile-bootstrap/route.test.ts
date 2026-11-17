import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureUserProfile } from "@/features/auth/auth-session";
import type { AuthProfile } from "@/features/auth/auth-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/auth/profile-bootstrap/route";

vi.mock("@/features/auth/auth-session", () => ({ ensureUserProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const sessionUser = { id: "user-1", email: "user@example.com", user_metadata: {} };
const profile: AuthProfile = {
  displayName: "User",
  preferredLanguageCode: "en",
  preferredUiLocale: "en",
  preferredTier: "A1",
  onboardingCompleted: false,
  aiPracticePoints: 0,
  chestPoints: 0,
};

afterEach(() => vi.clearAllMocks());

describe("POST /api/auth/profile-bootstrap", () => {
  it("creates or returns the authenticated user's missing profile", async () => {
    const supabase = { auth: { getSession: vi.fn().mockResolvedValue({
      data: { session: { user: sessionUser } },
      error: null,
    }) } };
    vi.mocked(createSupabaseServerClient).mockResolvedValue(supabase as never);
    vi.mocked(ensureUserProfile).mockResolvedValue({
      profile,
      onboardingCompleted: false,
      available: true,
      created: true,
    });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ available: true, created: true, profile });
    expect(ensureUserProfile).toHaveBeenCalledWith(supabase, sessionUser, {
      source: "client_session_recovery",
    });
  });

  it("does not attempt profile creation without a session", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
    } as never);

    const response = await POST();

    expect(response.status).toBe(401);
    expect(ensureUserProfile).not.toHaveBeenCalled();
  });
});
