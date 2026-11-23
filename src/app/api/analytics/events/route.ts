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

const tutorialCardAddMethodSchema = z.enum(["random", "custom", "group"]);
const tutorialCardsAddedCountSchema = z.number().int().min(1).max(1_000);

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
    "method",
    "added_count",
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
    "tutorial_card_add_method_selected",
    "tutorial_cards_added",
    "onboarding_completed",
    "app_opened",
    "first_card_added",
    "first_quiz_completed",
    "first_card_learned",
    "learn_session_completed",
    "landing_review_opened",
    "landing_card_podium_opened",
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

  if (event.event_name === "tutorial_card_add_method_selected") {
    const method = event.properties?.method;
    if (method === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["properties", "method"],
        message: "Tutorial card-add method events require a method",
      });
    } else if (!tutorialCardAddMethodSchema.safeParse(method).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["properties", "method"],
        message: "Invalid tutorial card-add method",
      });
    }
  }

  if (event.event_name === "tutorial_cards_added") {
    const addedCount = event.properties?.added_count;
    if (addedCount === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["properties", "added_count"],
        message: "Tutorial card-add events require an added count",
      });
    } else if (!tutorialCardsAddedCountSchema.safeParse(addedCount).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["properties", "added_count"],
        message: "Invalid tutorial added card count",
      });
    }

    const method = event.properties?.method;
    if (method === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["properties", "method"],
        message: "Tutorial card-add events require a method",
      });
    } else if (!tutorialCardAddMethodSchema.safeParse(method).success) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["properties", "method"],
        message: "Invalid tutorial card-add method",
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
