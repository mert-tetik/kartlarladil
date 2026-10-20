import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/auth/callback/route";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  ensureUserProfile: vi.fn(),
  recordAppLogin: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: () => true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  })),
}));

vi.mock("@/features/auth/auth-session", () => ({
  ensureUserProfile: mocks.ensureUserProfile,
}));

vi.mock("@/features/auth/login-events", () => ({
  recordAppLogin: mocks.recordAppLogin,
}));

vi.mock("@/i18n/server", () => ({
  getServerLocale: vi.fn(async () => "en"),
}));

describe("Google OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.recordAppLogin.mockResolvedValue(undefined);
    mocks.ensureUserProfile.mockResolvedValue({ onboardingCompleted: true });
  });

  it("returns native OAuth PKCE failures to the app WebView for code exchange", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: {
        code: "pkce_code_verifier_not_found",
        message: "PKCE code verifier not found in storage",
      },
    });

    const request = new NextRequest(
      "https://www.foxiesdeck.com/auth/callback?code=auth-code&native=1&next=%2F%3FmobileLanguageRefresh%3D1%26showOffer%3D1",
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "foxiesdeck://auth/callback?code=auth-code&next=%2F%3FmobileLanguageRefresh%3D1%26showOffer%3D1",
    );
  });

  it("keeps non-native PKCE failures on the existing web recovery path", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: {
        code: "pkce_code_verifier_not_found",
        message: "PKCE code verifier not found in storage",
      },
    });

    const request = new NextRequest("https://www.foxiesdeck.com/auth/callback?code=auth-code&next=%2Fcard-draw");
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/reset-password?message=");
  });

  it("does not loop when the WebView still cannot find the verifier after handoff", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: {
        code: "pkce_code_verifier_not_found",
        message: "PKCE code verifier not found in storage",
      },
    });

    const request = new NextRequest(
      "https://www.foxiesdeck.com/auth/callback?code=auth-code&native=1&nativeHandoff=1&next=%2F",
    );
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/login?message=");
  });
});
