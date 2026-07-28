import "server-only";

import crypto from "node:crypto";

export const X_OAUTH_STATE_COOKIE = "foxiesdeck:social-x-oauth-state";
export const X_OAUTH_STATE_MAX_AGE = 10 * 60;

const STATE_VERSION = "v1";

export type XOAuthState = {
  socialMediaId: number;
  state: string;
  codeVerifier: string;
  expiresAt: number;
};

function getStateSecret() {
  const secret = process.env.SOCIAL_AUTOMATION_OAUTH_STATE_SECRET?.trim();
  if (!secret) {
    throw new Error("SOCIAL_AUTOMATION_OAUTH_STATE_SECRET is required for social OAuth.");
  }

  return secret;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", getStateSecret()).update(payload).digest("base64url");
}

function randomBase64Url(bytes: number) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function createPkceChallenge(codeVerifier: string) {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

export function createXOAuthState(socialMediaId: number) {
  if (!Number.isSafeInteger(socialMediaId) || socialMediaId < 1) {
    throw new Error("A valid social media account is required.");
  }

  const data: XOAuthState = {
    socialMediaId,
    state: randomBase64Url(32),
    codeVerifier: randomBase64Url(64),
    expiresAt: Math.floor(Date.now() / 1000) + X_OAUTH_STATE_MAX_AGE,
  };
  const payload = `${STATE_VERSION}.${Buffer.from(JSON.stringify(data)).toString("base64url")}`;

  return {
    data,
    cookieValue: `${payload}.${sign(payload)}`,
  };
}

export function readXOAuthState(cookieValue: string | undefined) {
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
    const parsed = JSON.parse(Buffer.from(encodedData, "base64url").toString("utf8")) as Partial<XOAuthState>;
    if (
      !Number.isSafeInteger(parsed.socialMediaId) || parsed.socialMediaId < 1 ||
      typeof parsed.state !== "string" || parsed.state.length < 32 ||
      typeof parsed.codeVerifier !== "string" || parsed.codeVerifier.length < 43 ||
      !Number.isSafeInteger(parsed.expiresAt) || parsed.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return parsed as XOAuthState;
  } catch {
    return null;
  }
}

export function hasMatchingXOAuthState(savedState: XOAuthState, returnedState: string | null) {
  if (!returnedState) return false;

  const expected = Buffer.from(savedState.state);
  const actual = Buffer.from(returnedState);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export const xOAuthStateCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/twitter-automation/oauth/x",
  maxAge: X_OAUTH_STATE_MAX_AGE,
};
