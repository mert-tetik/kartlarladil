import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createPkceChallenge,
  createXOAuthState,
  hasMatchingXOAuthState,
  readXOAuthState,
} from "@/features/twitter-automation/social-oauth-state";

const originalSecret = process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET;

beforeEach(() => {
  process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET = "test-social-oauth-state-secret";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET;
  else process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET = originalSecret;
});

describe("X OAuth state", () => {
  it("round-trips a signed state and creates an S256 PKCE challenge", () => {
    const created = createXOAuthState(5);
    const restored = readXOAuthState(created.cookieValue);

    expect(restored).toMatchObject({ socialMediaId: 5, state: created.data.state });
    expect(hasMatchingXOAuthState(restored!, created.data.state)).toBe(true);
    expect(createPkceChallenge(created.data.codeVerifier)).toHaveLength(43);
  });

  it("rejects a modified state cookie", () => {
    const created = createXOAuthState(5);
    const modified = `${created.cookieValue.slice(0, -1)}x`;

    expect(readXOAuthState(modified)).toBeNull();
  });
});
