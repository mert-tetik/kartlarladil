"use client";

import { PUSH_APP_SURFACE, type PushPermissionState, type WebPushSubscriptionJson } from "@/features/push/push-types";

export const FIRST_CARD_ADDED_EVENT = "foxiesdeck:first-card-added";
export const POST_PRACTICE_TUTORIAL_COMPLETED_EVENT = "foxiesdeck:post-practice-tutorial-completed";
export const POST_PRACTICE_NOTIFICATION_PROMPT_EVENT = "foxiesdeck:post-practice-notification-prompt";
export const PUSH_PROMPT_DISMISSED_UNTIL_KEY = "foxiesdeck:push:prompt-dismissed-until";
export const PUSH_ACTIVITY_PING_PREFIX = "foxiesdeck:push:last-activity-ping";
export const PUSH_ACTIVITY_DEBOUNCE_MS = 15 * 60 * 1000;
export const PUSH_PROMPT_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function getCurrentPushPermission(): PushPermissionState {
  if (!isPushSupported()) {
    return "default";
  }

  return Notification.permission;
}

export async function getCurrentBrowserPushSubscription() {
  if (!isPushSupported()) {
    return null;
  }

  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function ensureBrowserPushSubscription(publicKey: string) {
  const existing = await getCurrentBrowserPushSubscription();

  if (existing) {
    return existing;
  }

  const registration = await navigator.serviceWorker.ready;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeBase64Url(publicKey),
  });
}

export function serializePushSubscription(subscription: PushSubscription): WebPushSubscriptionJson {
  const json = subscription.toJSON();

  return {
    endpoint: json.endpoint ?? subscription.endpoint,
    expirationTime: json.expirationTime ?? subscription.expirationTime ?? null,
    keys: {
      auth: json.keys?.auth ?? "",
      p256dh: json.keys?.p256dh ?? "",
    },
  };
}

export async function unsubscribeBrowserPushSubscription() {
  const subscription = await getCurrentBrowserPushSubscription();

  if (!subscription) {
    return { endpoint: undefined };
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => undefined);
  return { endpoint };
}

export function readPushPromptDismissedUntil() {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem(PUSH_PROMPT_DISMISSED_UNTIL_KEY);
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function markPushPromptDismissed(until = Date.now() + PUSH_PROMPT_DISMISS_MS) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PUSH_PROMPT_DISMISSED_UNTIL_KEY, String(until));
}

export function clearPushPromptDismissed() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PUSH_PROMPT_DISMISSED_UNTIL_KEY);
}

export function readLastPushActivityPing(userId: string) {
  if (typeof window === "undefined") {
    return 0;
  }

  const raw = window.localStorage.getItem(getPushActivityPingKey(userId));
  const parsed = raw ? Number(raw) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function writeLastPushActivityPing(userId: string, at = Date.now()) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getPushActivityPingKey(userId), String(at));
}

export function getPushActivityPingKey(userId: string) {
  return `${PUSH_ACTIVITY_PING_PREFIX}:${userId}:${PUSH_APP_SURFACE}`;
}

function decodeBase64Url(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
}
