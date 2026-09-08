import "server-only";

import crypto from "node:crypto";
import { hasDeveloperAdminRequest } from "@/features/developer/developer-auth";

export const AUTOMATION_RENDERER_SESSION_COOKIE = "foxiesdeck:automation-renderer";
export const AUTOMATION_RENDERER_SESSION_MAX_AGE = 60 * 60 * 12;
export const SOCIAL_AUTOMATION_INTERNAL_SESSION_COOKIE = "foxiesdeck:automation-internal";
export const SOCIAL_AUTOMATION_INTERNAL_SESSION_MAX_AGE = 60 * 5;

const RENDERER_SESSION_VERSION = "renderer-v1";
const INTERNAL_SESSION_VERSION = "internal-v1";

function getSessionSecret() {
  return process.env.SOCIAL_STUDIO_AUTH_SECRET?.trim() ?? "";
}

function sign(value: string) {
  const secret = getSessionSecret();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function getInternalSessionSecret() {
  return process.env.SOCIAL_AUTOMATION_INTERNAL_SECRET?.trim() ?? "";
}

function signInternal(value: string) {
  const secret = getInternalSessionSecret();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(";")) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return value.join("=");
  }

  return null;
}

export async function hasSocialStudioSession(cookieHeader: string | null) {
  return hasInternalAutomationSession(cookieHeader) || await hasDeveloperAdminRequest(cookieHeader);
}

function hasInternalAutomationSession(cookieHeader: string | null) {
  const session = readCookie(cookieHeader, SOCIAL_AUTOMATION_INTERNAL_SESSION_COOKIE);
  if (!session) return false;

  const [encodedPayload, receivedSignature, ...rest] = session.split(".");
  if (!encodedPayload || !receivedSignature || rest.length > 0) return false;

  let payload: string;
  try {
    payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  } catch {
    return false;
  }

  const expectedSignature = signInternal(payload);
  if (!expectedSignature) return false;
  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(receivedSignature);
  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) return false;

  const [version, rawExpiresAt] = payload.split(":");
  const expiresAt = Number(rawExpiresAt);
  return version === INTERNAL_SESSION_VERSION && Number.isSafeInteger(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}

export function createSocialAutomationInternalSession() {
  const secret = getInternalSessionSecret();
  if (!secret) throw new Error("SOCIAL_AUTOMATION_INTERNAL_SECRET is required for automation workers.");
  const expiresAt = Math.floor(Date.now() / 1000) + SOCIAL_AUTOMATION_INTERNAL_SESSION_MAX_AGE;
  const payload = `${INTERNAL_SESSION_VERSION}:${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${signInternal(payload)!}`;
}

export function createAutomationRendererSession(rendererId: string, ownerKey: string) {
  if (!getSessionSecret()) throw new Error("SOCIAL_STUDIO_AUTH_SECRET is required for automation renderers.");
  const expiresAt = Math.floor(Date.now() / 1000) + AUTOMATION_RENDERER_SESSION_MAX_AGE;
  const payload = `${RENDERER_SESSION_VERSION}:${rendererId}:${ownerKey}:${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)!}`;
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
  if (!expectedSignature) return null;
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

export async function hasSocialStudioAutomationSession(cookieHeader: string | null) {
  return hasAutomationRendererSession(cookieHeader) || await hasSocialStudioSession(cookieHeader);
}
