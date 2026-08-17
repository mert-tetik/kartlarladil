import { NextRequest, NextResponse } from "next/server";
import { webPushSubscriptionSchema } from "@/features/push/push-schema";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = webPushSubscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_push_subscription" }, { status: 400 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(request.nextUrl.searchParams.get("scope")));
  const { error } = await createSupabaseAdminClient().from("social_content_automation_push_subscriptions").upsert({ owner_key: ownerKey, endpoint: parsed.data.endpoint, subscription: parsed.data, active: true, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ errorCode: "automation_push_subscription_failed" }, { status: 503 });
  return NextResponse.json({ subscribed: true });
}
