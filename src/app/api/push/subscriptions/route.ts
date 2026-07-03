import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { pushSubscriptionUpsertSchema, pushSubscriptionDeleteSchema } from "@/features/push/push-schema";
import { PUSH_APP_SURFACE } from "@/features/push/push-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const parsed = pushSubscriptionUpsertSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { subscription, permission_state, app_surface } = parsed.data;

  if (app_surface !== PUSH_APP_SURFACE) {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const { error: subscriptionError } = await admin.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      subscription,
      app_surface,
      permission_state,
      is_active: true,
      last_active_at: now,
      cooldown_until: null,
      last_inactivity_stage: 0,
    },
    { onConflict: "endpoint" },
  );

  if (subscriptionError) {
    return NextResponse.json({ errorCode: "upsert_failed", message: subscriptionError.message }, { status: 500 });
  }

  const { error: profileError } = await admin
    .from("user_profiles")
    .update({ push_marketing_enabled: true })
    .eq("user_id", user.id);

  if (profileError) {
    return NextResponse.json({ errorCode: "profile_update_failed", message: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const parsed = pushSubscriptionDeleteSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("push_subscriptions")
    .update({ is_active: false, cooldown_until: null })
    .eq("user_id", user.id)
    .eq("app_surface", PUSH_APP_SURFACE);

  if (parsed.data.endpoint) {
    query = query.eq("endpoint", parsed.data.endpoint);
  }

  const { error: subscriptionError } = await query;

  if (subscriptionError) {
    return NextResponse.json({ errorCode: "unsubscribe_failed", message: subscriptionError.message }, { status: 500 });
  }

  const { error: profileError } = await admin
    .from("user_profiles")
    .update({ push_marketing_enabled: false })
    .eq("user_id", user.id);

  if (profileError) {
    return NextResponse.json({ errorCode: "profile_update_failed", message: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
