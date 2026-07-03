import { z } from "zod";
import { PUSH_APP_SURFACE } from "@/features/push/push-types";

const subscriptionKeysSchema = z.object({
  auth: z.string().min(1),
  p256dh: z.string().min(1),
});

export const webPushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: subscriptionKeysSchema,
});

export const pushSubscriptionUpsertSchema = z.object({
  subscription: webPushSubscriptionSchema,
  permission_state: z.enum(["default", "granted", "denied"]).default("granted"),
  app_surface: z.literal(PUSH_APP_SURFACE),
});

export const pushSubscriptionDeleteSchema = z
  .object({
    endpoint: z.string().url().optional(),
  })
  .optional()
  .default({});

export const pushActivitySchema = z
  .object({
    app_surface: z.literal(PUSH_APP_SURFACE).optional(),
  })
  .optional()
  .default({});

export const pushOpenSchema = z.object({
  logId: z.string().uuid(),
  token: z.string().min(1).optional(),
});
