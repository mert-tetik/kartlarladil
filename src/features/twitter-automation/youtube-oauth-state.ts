import "server-only";

import crypto from "node:crypto";

export const YOUTUBE_OAUTH_STATE_COOKIE = "foxiesdeck:social-youtube-oauth-state";
export const YOUTUBE_OAUTH_STATE_MAX_AGE = 10 * 60;

const STATE_VERSION = "v1";

export type YouTubeOAuthState = {
  socialMediaId: number;
  state: string;
  expiresAt: number;
};

function getStateSecret() {
  const secret = process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET?.trim();
  if (!secret) throw new Error("SOCIAL_AUTOMATION_OAUTH_STATE_SECRET is required for social OAuth.");
  return secret;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

export function createYouTubeOAuthState(socialMediaId: number) {
  if (!Number.isSafeInteger(socialMediaId) || socialMediaId < 1) {
    throw new Error("A valid social media account is required.");
  }

  const data: YouTubeOAuthState = {
    socialMediaId,
    state: crypto.randomBytes(32).toString("base64url"),
    expiresAt: Math.floor(Date.now() / 1000) + YOUTUBE_OAUTH_STATE_MAX_AGE,
  };
  const payload = `${STATE_VERSION}.${Buffer.from(JSON.stringify(data)).toString("base64url")}`;
  return { data, cookieValue: `${payload}.${sign(payload)}` };
}

export function readYouTubeOAuthState(cookieValue: string | undefined) {
  if (!cookieValue) return null;

  const [version, encodedData, receivedSignature, ...rest] = cookieValue.split(".");
  if (version !== STATE_VERSION || !encodedData || !receivedSignature || rest.length) return null;

  const payload = `${version}.${encodedData}`;
  const expectedSignature = sign(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(receivedSignature);
  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encodedData, "base64url").toString("utf8")) as Partial<YouTubeOAuthState>;
    const socialMediaId = parsed.socialMediaId;
    const state = parsed.state;
    const expiresAt = parsed.expiresAt;
    if (
      typeof socialMediaId !== "number" || !Number.isSafeInteger(socialMediaId) || socialMediaId < 1 ||
      typeof state !== "string" || state.length < 32 ||
      typeof expiresAt !== "number" || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return { socialMediaId, state, expiresAt };
  } catch {
    return null;
  }
}

export function hasMatchingYouTubeOAuthState(savedState: YouTubeOAuthState, returnedState: string | null) {
  if (!returnedState) return false;

  const expected = Buffer.from(savedState.state);
  const actual = Buffer.from(returnedState);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export const youTubeOAuthStateCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/twitter-automation/oauth/youtube",
  maxAge: YOUTUBE_OAUTH_STATE_MAX_AGE,
};
