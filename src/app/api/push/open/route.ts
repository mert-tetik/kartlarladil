import { NextResponse } from "next/server";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { pushOpenSchema } from "@/features/push/push-schema";
import { verifyPushOpenToken } from "@/features/push/push-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = pushOpenSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ errorCode: "invalid_request" }, { status: 400 });
  }

  const { logId, token } = parsed.data;
  const openedAt = new Date().toISOString();

  if (token && verifyPushOpenToken(logId, token)) {
    const admin = createSupabaseAdminClient();
    const { error } = await admin
      .from("notification_logs")
      .update({ status: "opened", opened_at: openedAt })
      .eq("id", logId);

    if (error) {
      return NextResponse.json({ errorCode: "open_update_failed", message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const user = await getCurrentAuthUser();

  if (!user) {
    return NextResponse.json({ errorCode: "auth_required" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notification_logs")
    .update({ status: "opened", opened_at: openedAt })
    .eq("id", logId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ errorCode: "open_update_failed", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
