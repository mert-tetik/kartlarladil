import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scheduleReadyAutomationRun } from "@/features/twitter-automation/automation-run-service";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ runId: z.string().uuid(), scope: z.enum(["production", "test"]).optional() }).strict();

export async function POST(request: NextRequest) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_run" }, { status: 400 });
  const scope = normalizeAutomationScope(parsed.data.scope);
  if (scope === "test") return NextResponse.json({ errorCode: "test_automation_schedule_disabled" }, { status: 403 });
  const ownerKey = automationOwnerKey(scope);

  try {
    const supabase = createSupabaseAdminClient();
    const { data: run, error } = await supabase
      .from("social_content_automation_runs")
      .select("id")
      .eq("id", parsed.data.runId)
      .eq("owner_key", ownerKey)
      .maybeSingle();
    if (error) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!run) return NextResponse.json({ errorCode: "automation_run_not_found" }, { status: 404 });

    const result = await scheduleReadyAutomationRun(run.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ errorCode: error instanceof Error ? error.message : "automation_schedule_failed" }, { status: 502 });
  }
}
