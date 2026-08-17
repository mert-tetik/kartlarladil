import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refreshAutomationRunStatus } from "@/features/twitter-automation/automation-run-service";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { hasSocialStudioAutomationSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const STALE_PROCESSING_MS = 3 * 60_000;

const requestSchema = z.object({
  outputId: z.string().uuid(),
  scope: z.enum(["production", "test"]).optional(),
}).strict();

type RetryableOutput = {
  id: string;
  run_id: string;
  status: string;
  content_type: "text" | "image" | "video";
  caption: string | null;
  media_path: string | null;
  media_paths: unknown;
  media_type: "image" | "video" | null;
  generator: string;
  error_code: string | null;
  provider_task_id: string | null;
  updated_at: string;
};

function hasReusableMedia(output: RetryableOutput) {
  return Boolean(output.caption && output.media_type && (output.media_path || (Array.isArray(output.media_paths) && output.media_paths.length)));
}

function hasReusableContent(output: RetryableOutput) {
  return output.content_type === "text" ? Boolean(output.caption) : hasReusableMedia(output);
}

function shouldRetryBrowserVideo(output: RetryableOutput) {
  return output.generator.startsWith("music-")
    && output.media_type === "image"
    && Boolean(output.media_path);
}

function isStaleProcessing(output: RetryableOutput) {
  if (output.status !== "processing") return false;
  const updatedAt = new Date(output.updated_at).getTime();
  return Number.isFinite(updatedAt) && Date.now() - updatedAt >= STALE_PROCESSING_MS;
}

function statusForRetry(output: RetryableOutput) {
  if (shouldRetryBrowserVideo(output)) return "awaiting_browser_video";
  if (output.status === "processing" && output.provider_task_id && output.media_type !== "video") return "generating_video";
  return hasReusableContent(output) ? "ready_to_schedule" : "queued";
}

export async function POST(request: NextRequest) {
  if (!hasSocialStudioAutomationSession(request.headers.get("cookie"))) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_output" }, { status: 400 });

  const ownerKey = automationOwnerKey(normalizeAutomationScope(parsed.data.scope));

  try {
    const supabase = createSupabaseAdminClient();
    const { data: output, error: outputError } = await supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,status,content_type,caption,media_path,media_paths,media_type,generator,error_code,provider_task_id,updated_at,attempt_count,next_attempt_at")
      .eq("id", parsed.data.outputId)
      .maybeSingle<RetryableOutput>();
    if (outputError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!output) return NextResponse.json({ errorCode: "automation_output_not_found" }, { status: 404 });

    const { data: run, error: runError } = await supabase
      .from("social_content_automation_runs")
      .select("id")
      .eq("id", output.run_id)
      .eq("owner_key", ownerKey)
      .maybeSingle();
    if (runError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!run) return NextResponse.json({ errorCode: "automation_output_not_found" }, { status: 404 });
    const retryingStaleProcessing = isStaleProcessing(output);
    if (output.status !== "failed" && !retryingStaleProcessing) return NextResponse.json({ errorCode: "automation_output_retry_not_available" }, { status: 409 });

    const status = statusForRetry(output);
    const retryPatch = status === "awaiting_browser_video" || status === "generating_video" || status === "ready_to_schedule"
      ? { status, error_code: null, retry_exhausted_at: null, next_attempt_at: new Date().toISOString(), generation_attempt_started_at: null, updated_at: new Date().toISOString() }
      : {
        status,
        caption: null,
        media_path: null,
        media_paths: [],
        media_type: null,
        provider_task_id: null,
        error_code: null,
        retry_exhausted_at: null,
        next_attempt_at: new Date().toISOString(),
        generated_at: null,
        generation_attempt_started_at: null,
        updated_at: new Date().toISOString(),
      };
    const { error: retryError } = await supabase
      .from("social_content_automation_outputs")
      .update(retryPatch)
      .eq("id", output.id)
      .eq("status", output.status);
    if (retryError) return NextResponse.json({ errorCode: "automation_output_retry_failed" }, { status: 503 });

    await refreshAutomationRunStatus(run.id);
    return NextResponse.json({ outputId: output.id, status });
  } catch (error) {
    return NextResponse.json({ errorCode: error instanceof Error ? error.message : "automation_output_retry_failed" }, { status: 502 });
  }
}
