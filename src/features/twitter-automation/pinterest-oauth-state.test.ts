import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createPinterestOAuthState,
  hasMatchingPinterestOAuthState,
  readPinterestOAuthState,
} from "@/features/twitter-automation/pinterest-oauth-state";

const originalSecret = process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET;

beforeEach(() => {
  process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET = "test-social-oauth-state-secret";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET;
  else process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET = originalSecret;
});

describe("Pinterest OAuth state", () => {
  it("round-trips a signed state", () => {
    const created = createPinterestOAuthState(7);
    const restored = readPinterestOAuthState(created.cookieValue);

    expect(restored).toMatchObject({ socialMediaId: 7, state: created.data.state });
    expect(hasMatchingPinterestOAuthState(restored!, created.data.state)).toBe(true);
  });

  it("rejects a modified state cookie", () => {
    const created = createPinterestOAuthState(7);
    const modified = `${created.cookieValue.slice(0, -1)}x`;

    expect(readPinterestOAuthState(modified)).toBeNull();
  });
});
