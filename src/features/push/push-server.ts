import "server-only";

import crypto from "node:crypto";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LOCALE_CODES } from "@/data/languages";
import { createTranslator } from "@/i18n/dictionaries";
import type { LocaleCode } from "@/types/domain";
import {
  PUSH_APP_SURFACE,
  type PushInactivityStage,
  type PushSubscriptionRecord,
  type WebPushSubscriptionJson,
} from "@/features/push/push-types";

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVITY_STAGES: ReadonlyArray<{ stage: PushInactivityStage; days: number }> = [
  { stage: 3, days: 8 },
  { stage: 2, days: 4 },
  { stage: 1, days: 2 },
];

interface UserPushProfileRow {
  user_id: string;
  preferred_ui_locale: string | null;
  push_marketing_enabled: boolean | null;
}

interface NotificationPayload {
  title: string;
  body: string;
  targetUrl: string;
  tag: string;
  logId: string;
  openToken: string;
}

export interface PushSendSummary {
  considered: number;
  sent: number;
  failed: number;
  skipped: number;
  deactivated: number;
}

export function getDueInactivityStage(
  lastActiveAt: string | Date | null | undefined,
  lastInactivityStage: number,
  now = new Date(),
): PushInactivityStage | null {
  if (!lastActiveAt) {
    return null;
  }

  const activeAt = lastActiveAt instanceof Date ? lastActiveAt : new Date(lastActiveAt);

  if (Number.isNaN(activeAt.getTime())) {
    return null;
  }

  const elapsed = now.getTime() - activeAt.getTime();

  for (const { stage, days } of INACTIVITY_STAGES) {
    if (elapsed >= days * DAY_MS && lastInactivityStage < stage) {
      return stage;
    }
  }

  return null;
}

export function normalizePushLocale(locale: string | null | undefined): LocaleCode {
  if (locale && LOCALE_CODES.includes(locale as LocaleCode)) {
    return locale as LocaleCode;
  }

  return "en";
}

export function buildInactivityNotification(locale: LocaleCode, stage: PushInactivityStage) {
  const t = createTranslator(locale);

  return {
    title: t(`push.inactivity.stage${stage}.title`),
    body: t(`push.inactivity.stage${stage}.body`),
  };
}

export function buildPushLandingUrl(origin?: string) {
  const base = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL?.trim() || origin);

  if (!base) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required for push notifications.");
  }

  return `${base}/`;
}

export function createPushOpenToken(logId: string) {
  const digest = crypto.createHmac("sha256", getPushSigningSecret()).update(`push-open:${logId}`).digest("base64url");
  return digest;
}

export function verifyPushOpenToken(logId: string, token: string) {
  const expected = Buffer.from(createPushOpenToken(logId));
  const actual = Buffer.from(token);

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}

export async function sendDueInactivityNotifications(
  supabase: SupabaseClient,
  origin?: string,
): Promise<PushSendSummary> {
  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, subscription, app_surface, permission_state, is_active, last_active_at, last_sent_at, cooldown_until, last_inactivity_stage, created_at")
    .eq("app_surface", PUSH_APP_SURFACE)
    .eq("permission_state", "granted")
    .eq("is_active", true);

  if (subscriptionError) {
    throw new Error(subscriptionError.message);
  }

  const summary: PushSendSummary = {
    considered: subscriptions?.length ?? 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    deactivated: 0,
  };

  if (!subscriptions?.length) {
    return summary;
  }

  const userIds = [...new Set(subscriptions.map((item) => item.user_id as string))];
  const { data: profiles, error: profileError } = await supabase
    .from("user_profiles")
    .select("user_id, preferred_ui_locale, push_marketing_enabled")
    .in("user_id", userIds);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const profileByUserId = new Map<string, UserPushProfileRow>(
    (profiles ?? []).map((profile) => [profile.user_id as string, profile as UserPushProfileRow]),
  );

  const now = new Date();
  const sentAtIso = now.toISOString();
  const cooldownUntilIso = new Date(now.getTime() + DAY_MS).toISOString();
  const targetUrl = buildPushLandingUrl(origin);

  for (const rawSubscription of subscriptions as PushSubscriptionRecord[]) {
    const profile = profileByUserId.get(rawSubscription.user_id);

    if (!profile?.push_marketing_enabled) {
      summary.skipped += 1;
      continue;
    }

    const cooldownUntil = rawSubscription.cooldown_until ? new Date(rawSubscription.cooldown_until) : null;
    if (cooldownUntil && cooldownUntil.getTime() > now.getTime()) {
      summary.skipped += 1;
      continue;
    }

    const stage = getDueInactivityStage(
      rawSubscription.last_active_at ?? rawSubscription.created_at ?? null,
      rawSubscription.last_inactivity_stage,
      now,
    );

    if (!stage) {
      summary.skipped += 1;
      continue;
    }

    const locale = normalizePushLocale(profile.preferred_ui_locale);
    const copy = buildInactivityNotification(locale, stage);
    const logId = crypto.randomUUID();
    const payload: NotificationPayload = {
      title: copy.title,
      body: copy.body,
      targetUrl,
      tag: `foxiesdeck-inactivity-${stage}`,
      logId,
      openToken: createPushOpenToken(logId),
    };

    try {
      await sendWebPushNotification(rawSubscription.subscription, payload);

      await safeInsertNotificationLog(supabase, {
        id: logId,
        user_id: rawSubscription.user_id,
        push_subscription_id: rawSubscription.id,
        campaign_type: "inactivity",
        stage,
        locale,
        title: copy.title,
        body: copy.body,
        target_url: targetUrl,
        status: "sent",
        error_message: null,
        sent_at: sentAtIso,
        opened_at: null,
      });

      await safeUpdateSubscription(supabase, rawSubscription.id, {
        last_sent_at: sentAtIso,
        cooldown_until: cooldownUntilIso,
        last_inactivity_stage: stage,
        permission_state: "granted",
      });

      summary.sent += 1;
    } catch (error) {
      const errorDetails = getPushErrorDetails(error);

      await safeInsertNotificationLog(supabase, {
        id: logId,
        user_id: rawSubscription.user_id,
        push_subscription_id: rawSubscription.id,
        campaign_type: "inactivity",
        stage,
        locale,
        title: copy.title,
        body: copy.body,
        target_url: targetUrl,
        status: "failed",
        error_message: errorDetails.message,
        sent_at: sentAtIso,
        opened_at: null,
      });

      if (errorDetails.shouldDeactivate) {
        await safeUpdateSubscription(supabase, rawSubscription.id, {
          is_active: false,
          cooldown_until: null,
        });
        summary.deactivated += 1;
      }

      summary.failed += 1;
    }
  }

  return summary;
}

async function sendWebPushNotification(subscription: WebPushSubscriptionJson, payload: NotificationPayload) {
  const vapidDetails = getVapidDetails();

  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    vapidDetails,
    TTL: 24 * 60 * 60,
    urgency: "high",
  });
}

function getVapidDetails() {
  const subject = process.env.VAPID_SUBJECT?.trim();
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();

  if (!subject || !publicKey || !privateKey) {
    throw new Error("Push VAPID environment variables are missing.");
  }

  return {
    subject,
    publicKey,
    privateKey,
  };
}

function getPushSigningSecret() {
  const secret = process.env.PUSH_CRON_SECRET?.trim();

  if (!secret) {
    throw new Error("PUSH_CRON_SECRET is required.");
  }

  return secret;
}

function normalizeOrigin(origin?: string) {
  if (!origin) {
    return null;
  }

  return origin.replace(/\/+$/, "");
}

function getPushErrorDetails(error: unknown) {
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as { statusCode?: unknown }).statusCode)
    : null;
  const body = typeof error === "object" && error !== null && "body" in error
    ? String((error as { body?: unknown }).body ?? "")
    : "";
  const message =
    error instanceof Error
      ? error.message
      : body || (statusCode ? `Push send failed with status ${statusCode}` : "Push send failed.");

  return {
    message: body ? `${message}: ${body}` : message,
    shouldDeactivate: statusCode === 404 || statusCode === 410,
  };
}

async function safeInsertNotificationLog(
  supabase: SupabaseClient,
  values: Record<string, unknown>,
) {
  const { error } = await supabase.from("notification_logs").insert(values);

  if (error) {
    console.error("Failed to insert notification log:", error.message);
  }
}

async function safeUpdateSubscription(
  supabase: SupabaseClient,
  subscriptionId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase
    .from("push_subscriptions")
    .update(values)
    .eq("id", subscriptionId);

  if (error) {
    console.error("Failed to update push subscription:", error.message);
  }
}
