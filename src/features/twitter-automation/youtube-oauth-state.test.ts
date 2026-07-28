import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createYouTubeOAuthState,
  hasMatchingYouTubeOAuthState,
  readYouTubeOAuthState,
} from "@/features/twitter-automation/youtube-oauth-state";

const originalSecret = process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET;

beforeEach(() => {
  process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET = "test-social-oauth-state-secret";
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET;
  else process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET = originalSecret;
});

describe("YouTube OAuth state", () => {
  it("round-trips a signed state", () => {
    const created = createYouTubeOAuthState(1);
    const restored = readYouTubeOAuthState(created.cookieValue);

    expect(restored).toMatchObject({ socialMediaId: 1, state: created.data.state });
    expect(hasMatchingYouTubeOAuthState(restored!, created.data.state)).toBe(true);
  });

  it("rejects a modified state cookie", () => {
    const created = createYouTubeOAuthState(1);
    expect(readYouTubeOAuthState(`${created.cookieValue.slice(0, -1)}x`)).toBeNull();
  });
});
