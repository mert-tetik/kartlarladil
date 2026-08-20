import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refreshAutomationOutputMediaPreviews } from "@/features/twitter-automation/automation-run-service";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ runId: z.string().uuid(), scope: z.enum(["production", "test"]).optional() }).strict();

export async function POST(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_run" }, { status: 400 });

  try {
    const scope = normalizeAutomationScope(parsed.data.scope);
    const supabase = createSupabaseAdminClient();
    const { data: run, error } = await supabase
      .from("social_content_automation_runs")
      .select("id")
      .eq("id", parsed.data.runId)
      .eq("owner_key", automationOwnerKey(scope))
      .maybeSingle();
    if (error) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!run) return NextResponse.json({ errorCode: "automation_run_not_found" }, { status: 404 });

    return NextResponse.json(await refreshAutomationOutputMediaPreviews(run.id));
  } catch (error) {
    return NextResponse.json({ errorCode: error instanceof Error ? error.message : "automation_media_refresh_failed" }, { status: 502 });
  }
}
