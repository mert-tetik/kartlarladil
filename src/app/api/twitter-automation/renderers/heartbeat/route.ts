import { NextRequest, NextResponse } from "next/server";
import { heartbeatAutomationRenderer } from "@/features/twitter-automation/automation-renderer-service";
import { getAutomationRendererSession } from "@/features/twitter-automation/social-studio-auth";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AUTOMATION_RENDERER_LEASE_MS } from "@/features/twitter-automation/automation-resilience";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ outputId: z.string().uuid().optional() }).strict();

export async function POST(request: NextRequest) {
  const session = getAutomationRendererSession(request.headers.get("cookie"));
  if (!session) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_renderer_heartbeat" }, { status: 400 });
  try {
    await heartbeatAutomationRenderer(session.rendererId, session.ownerKey);
    if (parsed.data.outputId) {
      const now = new Date().toISOString();
      const { error } = await createSupabaseAdminClient().from("social_content_automation_outputs").update({
        lease_expires_at: new Date(Date.now() + AUTOMATION_RENDERER_LEASE_MS).toISOString(),
        renderer_heartbeat_at: now,
        updated_at: now,
      }).eq("id", parsed.data.outputId).eq("lease_renderer_id", session.rendererId);
      if (error) throw new Error("automation_renderer_lease_heartbeat_failed");
    }
    return NextResponse.json({ heartbeatAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ errorCode: error instanceof Error ? error.message : "automation_renderer_heartbeat_failed" }, { status: 503 });
  }
}
