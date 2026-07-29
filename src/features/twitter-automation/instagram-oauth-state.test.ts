import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createInstagramOAuthState,
  hasMatchingInstagramOAuthState,
  readInstagramOAuthState,
} from "@/features/twitter-automation/instagram-oauth-state";

const originalSecret = process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET;

beforeEach(() => {
  process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET = "test-social-oauth-state-secret";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET;
  else process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET = originalSecret;
});

describe("Instagram OAuth state", () => {
  it("round-trips a signed state", () => {
    const created = createInstagramOAuthState(3);
    const restored = readInstagramOAuthState(created.cookieValue);

    expect(restored).toMatchObject({ socialMediaId: 3, state: created.data.state });
    expect(hasMatchingInstagramOAuthState(restored!, created.data.state)).toBe(true);
  });

  it("rejects a modified state cookie", () => {
    const created = createInstagramOAuthState(3);
    expect(readInstagramOAuthState(`${created.cookieValue.slice(0, -1)}x`)).toBeNull();
  });
});
