import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { pushActivitySchema } from "@/features/push/push-schema";
import { PUSH_APP_SURFACE } from "@/features/push/push-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const parsed = pushActivitySchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const appSurface = parsed.data.app_surface ?? PUSH_APP_SURFACE;
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .update({
      last_active_at: new Date().toISOString(),
      last_inactivity_stage: 0,
      cooldown_until: null,
    })
    .eq("user_id", user.id)
    .eq("app_surface", appSurface)
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ errorCode: "activity_update_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
