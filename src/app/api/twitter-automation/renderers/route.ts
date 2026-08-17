import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerAutomationRenderer } from "@/features/twitter-automation/automation-renderer-service";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({ label: z.string().trim().min(1).max(120), scope: z.enum(["production", "test"]).optional() }).strict();

function isAuthorized(request: NextRequest) {
  return hasSocialStudioSession(request.headers.get("cookie"));
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(request.nextUrl.searchParams.get("scope")));
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("social_content_automation_renderers").select("id,label,active,last_heartbeat_at,last_seen_at,created_at,revoked_at").eq("owner_key", ownerKey).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ errorCode: "automation_renderers_unavailable" }, { status: 503 });
  return NextResponse.json({ renderers: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_renderer" }, { status: 400 });
  try {
    const ownerKey = automationOwnerKey(normalizeAutomationScope(parsed.data.scope));
    const result = await registerAutomationRenderer(ownerKey, parsed.data.label);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ errorCode: error instanceof Error ? error.message : "automation_renderer_register_failed" }, { status: 503 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const rendererId = request.nextUrl.searchParams.get("rendererId");
  if (!rendererId || !z.string().uuid().safeParse(rendererId).success) return NextResponse.json({ errorCode: "invalid_automation_renderer" }, { status: 400 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(request.nextUrl.searchParams.get("scope")));
  const { error } = await createSupabaseAdminClient().from("social_content_automation_renderers").update({ active: false, revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", rendererId).eq("owner_key", ownerKey);
  if (error) return NextResponse.json({ errorCode: "automation_renderer_revoke_failed" }, { status: 503 });
  return NextResponse.json({ revoked: true });
}
