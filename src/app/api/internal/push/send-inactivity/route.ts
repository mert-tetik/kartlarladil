import { NextResponse } from "next/server";
import { sendDueInactivityNotifications } from "@/features/push/push-server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.PUSH_CRON_SECRET?.trim();
  const provided = request.headers.get("x-push-cron-secret")?.trim();

  if (!secret) {
    return NextResponse.json({ errorCode: "not_configured" }, { status: 500 });
  }

  if (!provided || provided !== secret) {
    return NextResponse.json({ errorCode: "forbidden" }, { status: 403 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const origin = new URL(request.url).origin;
    const summary = await sendDueInactivityNotifications(admin, origin);

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Push send failed.";
    return NextResponse.json({ errorCode: "send_failed", message }, { status: 500 });
  }
}
