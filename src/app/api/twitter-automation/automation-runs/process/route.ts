import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processAutomationOutput, refreshAutomationRunStatus, type AutomationOutputRecord } from "@/features/twitter-automation/automation-run-service";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const requestSchema = z.object({ outputId: z.string().uuid().optional() }).strict();

function isAuthorized(request: NextRequest) {
  return hasSocialStudioSession(request.headers.get("cookie"));
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_output" }, { status: 400 });

  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,media_path,media_type,provider_task_id,upload_post_jobs")
      .in("status", ["queued", "generating_video"])
      .order("scheduled_at", { ascending: true })
      .limit(1);
    if (parsed.data.outputId) query = query.eq("id", parsed.data.outputId);
    const { data: candidate, error: candidateError } = await query.maybeSingle<AutomationOutputRecord>();
    if (candidateError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!candidate) return NextResponse.json({ processed: false, state: "idle" });

    const { data: locked, error: lockError } = await supabase
      .from("social_content_automation_outputs")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", candidate.id)
      .eq("status", candidate.status)
      .select("id")
      .maybeSingle();
    if (lockError) return NextResponse.json({ errorCode: "automation_output_lock_failed" }, { status: 503 });
    if (!locked) return NextResponse.json({ processed: false, state: "busy" }, { status: 409 });

    const result = await processAutomationOutput(candidate);
    if (result.outcome === "video_pending") {
      await supabase.from("social_content_automation_outputs").update({ status: "generating_video", updated_at: new Date().toISOString() }).eq("id", candidate.id);
    }
    await refreshAutomationRunStatus(candidate.run_id);
    return NextResponse.json({ processed: true, outputId: candidate.id, ...result });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "automation_processing_failed";
    return NextResponse.json({ errorCode }, { status: 502 });
  }
}
