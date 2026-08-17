import "server-only";

import crypto from "node:crypto";

export const SOCIAL_STUDIO_SESSION_COOKIE = "foxiesdeck:social-studio";
export const SOCIAL_STUDIO_SESSION_MAX_AGE = 60 * 60 * 12;
export const AUTOMATION_RENDERER_SESSION_COOKIE = "foxiesdeck:automation-renderer";
export const AUTOMATION_RENDERER_SESSION_MAX_AGE = 60 * 60 * 12;

const ADMIN_USERNAME = "tetikmert";
const ADMIN_PASSWORD = "m25041979";
const SESSION_VERSION = "v1";
const RENDERER_SESSION_VERSION = "renderer-v1";

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
  return hasSignedSession(cookieHeader, SOCIAL_STUDIO_SESSION_COOKIE, SESSION_VERSION);
}

function hasSignedSession(cookieHeader: string | null, cookieName: string, version: string) {
  const session = readCookie(cookieHeader, cookieName);
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

  const [payloadVersion, rawExpiresAt] = payload.split(":");
  const expiresAt = Number(rawExpiresAt);
  return payloadVersion === version && Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}

export function createAutomationRendererSession(rendererId: string, ownerKey: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + AUTOMATION_RENDERER_SESSION_MAX_AGE;
  const payload = `${RENDERER_SESSION_VERSION}:${rendererId}:${ownerKey}:${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function getAutomationRendererSession(cookieHeader: string | null) {
  const session = readCookie(cookieHeader, AUTOMATION_RENDERER_SESSION_COOKIE);
  if (!session) return null;
  const [encodedPayload, receivedSignature, ...rest] = session.split(".");
  if (!encodedPayload || !receivedSignature || rest.length > 0) return null;

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSignature = sign(payload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(receivedSignature);
  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) return null;

  const [version, rendererId, ownerKey, rawExpiresAt, ...extra] = payload.split(":");
  const expiresAt = Number(rawExpiresAt);
  if (extra.length || version !== RENDERER_SESSION_VERSION || !/^[\da-f-]{36}$/iu.test(rendererId) || !ownerKey || !Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;
  return { rendererId, ownerKey, expiresAt };
}

export function hasAutomationRendererSession(cookieHeader: string | null) {
  return Boolean(getAutomationRendererSession(cookieHeader));
}

export function hasSocialStudioAutomationSession(cookieHeader: string | null) {
  return hasSocialStudioSession(cookieHeader) || hasAutomationRendererSession(cookieHeader);
}
