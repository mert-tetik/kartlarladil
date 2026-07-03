import type { LocaleCode } from "@/types/domain";

export const PUSH_APP_SURFACE = "twa_android" as const;

export type PushAppSurface = typeof PUSH_APP_SURFACE;
export type PushPermissionState = "default" | "granted" | "denied";
export type PushCampaignType = "inactivity";
export type PushLogStatus = "sent" | "failed" | "opened";
export type PushInactivityStage = 1 | 2 | 3;

export interface WebPushSubscriptionJson {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: WebPushSubscriptionJson;
  app_surface: PushAppSurface;
  permission_state: PushPermissionState;
  is_active: boolean;
  last_active_at: string | null;
  last_sent_at: string | null;
  cooldown_until: string | null;
  last_inactivity_stage: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface NotificationLogRecord {
  id: string;
  user_id: string;
  push_subscription_id: string | null;
  campaign_type: PushCampaignType;
  stage: PushInactivityStage;
  locale: LocaleCode;
  title: string;
  body: string;
  target_url: string;
  status: PushLogStatus;
  error_message: string | null;
  sent_at: string;
  opened_at: string | null;
}

export interface PushActionResult {
  ok: boolean;
  message?: string;
}
