import "server-only";

import crypto from "node:crypto";

export const SOCIAL_STUDIO_SESSION_COOKIE = "foxiesdeck:social-studio";
export const SOCIAL_STUDIO_SESSION_MAX_AGE = 60 * 60 * 12;

const ADMIN_USERNAME = "tetikmert";
const ADMIN_PASSWORD = "m25041979";
const SESSION_VERSION = "v1";

function getSessionSecret() {
  return process.env.SOCIAL_STUDIO_AUTH_SECRET?.trim() || "foxiesdeck-social-studio-session-v1";
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return value.join("=");
  }

  return null;
}

export function isSocialStudioAdminCredentials(username: string, password: string) {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function createSocialStudioSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + SOCIAL_STUDIO_SESSION_MAX_AGE;
  const payload = `${SESSION_VERSION}:${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function hasSocialStudioSession(cookieHeader: string | null) {
  const session = readCookie(cookieHeader, SOCIAL_STUDIO_SESSION_COOKIE);
  if (!session) return false;

  const [encodedPayload, receivedSignature, ...rest] = session.split(".");
  if (!encodedPayload || !receivedSignature || rest.length > 0) return false;

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const expectedSignature = sign(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(receivedSignature);
  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return false;
  }

  const [version, rawExpiresAt] = payload.split(":");
  const expiresAt = Number(rawExpiresAt);
  return version === SESSION_VERSION && Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}
