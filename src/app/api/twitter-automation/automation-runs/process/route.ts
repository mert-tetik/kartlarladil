import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processAutomationOutput, refreshAutomationRunStatus, type AutomationOutputRecord } from "@/features/twitter-automation/automation-run-service";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const requestSchema = z.object({
  outputId: z.string().uuid().optional(),
  scope: z.enum(["production", "test"]).optional(),
  stagedMediaPath: z.string().regex(/^automation\/[\da-f-]+\.webm$/iu).optional(),
  caption: z.string().trim().min(1).max(400).optional(),
}).strict().superRefine((value, context) => {
  if (value.stagedMediaPath && !value.outputId) context.addIssue({ code: "custom", path: ["outputId"], message: "Output id is required." });
  if (value.caption && !value.stagedMediaPath) context.addIssue({ code: "custom", path: ["caption"], message: "A staged video is required." });
});

function isAuthorized(request: NextRequest) {
  return hasSocialStudioSession(request.headers.get("cookie"));
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_output" }, { status: 400 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(parsed.data.scope));

  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,media_path,media_type,provider_task_id,upload_post_jobs")
      .in("status", parsed.data.stagedMediaPath ? ["awaiting_browser_video"] : ["queued", "generating_video"])
      .order("scheduled_at", { ascending: true })
      .limit(1);
    if (parsed.data.outputId) query = query.eq("id", parsed.data.outputId);
    const { data: candidate, error: candidateError } = await query.maybeSingle<AutomationOutputRecord>();
    if (candidateError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!candidate) return NextResponse.json({ processed: false, state: "idle" });

    const { data: run, error: runError } = await supabase
      .from("social_content_automation_runs")
      .select("id")
      .eq("id", candidate.run_id)
      .eq("owner_key", ownerKey)
      .maybeSingle();
    if (runError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!run) return NextResponse.json({ errorCode: "automation_output_not_found" }, { status: 404 });

    const update = parsed.data.stagedMediaPath
      ? { status: "ready_to_schedule", media_path: parsed.data.stagedMediaPath, media_type: "video", ...(parsed.data.caption ? { caption: parsed.data.caption } : {}), updated_at: new Date().toISOString() }
      : { status: "processing", updated_at: new Date().toISOString() };
    const { data: locked, error: lockError } = await supabase
      .from("social_content_automation_outputs")
      .update(update)
      .eq("id", candidate.id)
      .eq("status", candidate.status)
      .select("id")
      .maybeSingle();
    if (lockError) return NextResponse.json({ errorCode: "automation_output_lock_failed" }, { status: 503 });
    if (!locked) return NextResponse.json({ processed: false, state: "busy" }, { status: 409 });

    if (parsed.data.stagedMediaPath && candidate.media_path?.startsWith("automation/")) {
      const { error: removeError } = await supabase.storage.from("social-studio-automation").remove([candidate.media_path]);
      if (removeError) throw new Error("automation_media_cleanup_failed");
    }

    if (parsed.data.stagedMediaPath) {
      await refreshAutomationRunStatus(candidate.run_id);
      return NextResponse.json({ processed: true, outputId: candidate.id, outcome: "content_ready" });
    }

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
