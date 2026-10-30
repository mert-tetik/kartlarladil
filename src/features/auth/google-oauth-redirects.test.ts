import { describe, expect, it } from "vitest";
import {
  getGoogleOAuthRedirectTo,
  getNativeGoogleAuthHandoffUrl,
  isPkceCodeVerifierError,
} from "@/features/auth/google-oauth-redirects";

describe("Google OAuth redirects", () => {
  it("uses the native deep link so the WebView can exchange its own PKCE verifier", () => {
    const redirectTo = new URL(getGoogleOAuthRedirectTo(
      "https://www.foxiesdeck.com",
      "/?mobileLanguageRefresh=1&showOffer=1",
      true,
    ));

    expect(redirectTo.protocol).toBe("foxiesdeck:");
    expect(redirectTo.host).toBe("auth");
    expect(redirectTo.pathname).toBe("/callback");
    expect(redirectTo.searchParams.get("next")).toBe("/?mobileLanguageRefresh=1&showOffer=1");
  });

  it("keeps ordinary web OAuth redirects on HTTPS without a native marker", () => {
    const redirectTo = new URL(getGoogleOAuthRedirectTo(
      "https://www.foxiesdeck.com",
      "/card-draw",
      false,
    ));

    expect(redirectTo.protocol).toBe("https:");
    expect(redirectTo.searchParams.get("native")).toBeNull();
  });

  it("hands the authorization code back to the native app callback", () => {
    const handoff = new URL(getNativeGoogleAuthHandoffUrl("oauth-code", "/?showOffer=1"));

    expect(handoff.protocol).toBe("foxiesdeck:");
    expect(handoff.host).toBe("auth");
    expect(handoff.pathname).toBe("/callback");
    expect(handoff.searchParams.get("code")).toBe("oauth-code");
    expect(handoff.searchParams.get("next")).toBe("/?showOffer=1");
  });

  it("recognizes PKCE verifier errors without treating unrelated auth errors as handoff candidates", () => {
    expect(isPkceCodeVerifierError({ code: "pkce_code_verifier_not_found" })).toBe(true);
    expect(isPkceCodeVerifierError({ message: "PKCE code verifier is missing" })).toBe(true);
    expect(isPkceCodeVerifierError({ code: "invalid_grant", message: "OAuth failed" })).toBe(false);
  });
});
