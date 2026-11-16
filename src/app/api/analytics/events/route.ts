import { z } from "zod";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subscriptionRestrictionCodeSchema = z.enum([
  "free_active_card_limit",
  "free_learned_card_limit",
  "learned_review_subscription_required",
  "ai_daily_limit",
  "ai_monthly_limit",
  "image_text_translate_limit",
  "learn_locale_locked",
  "inventory_card_already_active",
  "inventory_card_already_learned",
  "language_match_not_allowed",
  "game_language_match_not_allowed",
  "theme_subscription_required",
  "game_level_locked",
  "scenario_subscription_required",
]);

const analyticsPropertyKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const analyticsPropertyValueSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
]);
const analyticsPropertiesSchema = z.record(
  analyticsPropertyKeySchema,
  analyticsPropertyValueSchema,
).superRefine((properties, context) => {
  const allowedKeys = new Set([
    "onboarding_source",
    "learning_language",
    "ui_locale",
    "platform",
    "mode",
    "selected_count",
    "correct_count",
    "incorrect_count",
    "learned_count",
    "duration_seconds",
    "card_language",
    "card_tier",
    "term_kind",
    "plan",
    "billing_cycle",
    "source",
    "restriction_code",
    "sku",
    "error_code",
    "effective_plan",
    "had_purchases",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "gclid",
    "fbclid",
  ]);

  if (Object.keys(properties).length > 20) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Analytics events may contain at most 20 properties",
    });
  }

  for (const key of Object.keys(properties)) {
    if (!allowedKeys.has(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: "Unsupported analytics property",
      });
    }
  }
});

const analyticsEventSchema = z.object({
  event_name: z.enum([
    "tutorial_completed",
    "onboarding_completed",
    "app_opened",
    "first_card_added",
    "first_quiz_completed",
    "first_card_learned",
    "learn_session_completed",
    "pricing_page_viewed",
    "pricing_subscription_details_opened",
    "subscription_restriction_opened",
    "subscription_restriction_details_opened",
    "subscription_purchase_started",
    "subscription_purchase_succeeded",
    "subscription_purchase_failed",
    "subscription_purchase_cancelled",
    "subscription_restored",
    "subscription_restore_failed",
    "account_deleted",
  ]),
  properties: analyticsPropertiesSchema.optional(),
}).strict().superRefine((event, context) => {
  const requiresRestrictionCode = event.event_name === "subscription_restriction_opened"
    || event.event_name === "subscription_restriction_details_opened";

  if (requiresRestrictionCode && !event.properties?.restriction_code) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["properties", "restriction_code"],
      message: "Restriction events require a restriction code",
    });
  }

  if (event.properties?.restriction_code) {
    const restrictionCode = subscriptionRestrictionCodeSchema.safeParse(event.properties.restriction_code);
    if (!restrictionCode.success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["properties", "restriction_code"],
        message: "Invalid restriction code",
      });
    }
  }
});

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  // Keep best-effort telemetry quiet for signed-out or expired sessions.
  if (!user) return new Response(null, { status: 204 });

  const parsed = analyticsEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 204 });

  try {
    const { error } = await createSupabaseAdminClient()
      .from("analytics_events")
      .insert({
        user_id: user.id,
        event_name: parsed.data.event_name,
        properties: parsed.data.properties ?? {},
      });

    // A duplicate beacon is an expected idempotent retry, not an application
    // error. Other failures are logged server-side but never reach the user.
    if (error && error.code !== "23505") {
      console.error("[analytics.events] Failed to record analytics event", {
        eventName: parsed.data.event_name,
        error: error.message,
      });
    }
  } catch (error) {
    console.error("[analytics.events] Analytics unavailable", {
      eventName: parsed.data.event_name,
      error,
    });
  }

  return new Response(null, { status: 204 });
}
