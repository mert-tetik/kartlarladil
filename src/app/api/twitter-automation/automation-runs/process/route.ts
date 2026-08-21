import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processAutomationOutput, queueAutomationOutputRecovery, recordSuccessfulAutomationOutputDuration, refreshAutomationRunStatus, validateAutomationOutputQuality, type AutomationOutputRecord } from "@/features/twitter-automation/automation-run-service";
import { getAutomationRendererSession, hasSocialStudioAutomationSession } from "@/features/twitter-automation/social-studio-auth";
import { AUTOMATION_RENDERER_LEASE_MS } from "@/features/twitter-automation/automation-resilience";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";
import { createFoxiesDeckDownloadCaption } from "@/features/twitter-automation/social-video-titles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A single output can make a short PoYo attempt and up to three bounded direct
// OpenAI attempts. Keep the route alive long enough to preserve its staged
// media/caption checkpoints instead of terminating midway through a fallback.
export const maxDuration = 600;

const stagedMediaPathSchema = z.string().regex(/^automation\/[\da-f-]+(?:-\d+)?\.(?:png|webm)$/iu);
const BROWSER_IMAGE_GENERATORS = new Set([
  "word-of-the-day",
  "word-of-the-day-poster",
  "self-mini-quiz",
  "self-false-friends",
  "self-daily-challenge",
  "self-vocabulary-progression",
  "self-example-sentences",
  "vocabulary-carousel",
  "tier-progression-carousel",
]);

const requestSchema = z.object({
  outputId: z.string().uuid().optional(),
  scope: z.enum(["production", "test"]).optional(),
  stagedMediaPath: stagedMediaPathSchema.optional(),
  stagedMediaPaths: z.array(stagedMediaPathSchema).min(1).max(7).optional(),
  caption: z.string().trim().min(1).max(400).optional(),
  browserImageError: z.string().trim().min(1).max(120).optional(),
  browserVideoError: z.string().trim().min(1).max(120).optional(),
  browserRenderPlan: z.unknown().optional(),
}).strict().superRefine((value, context) => {
  const stagedPaths = value.stagedMediaPaths ?? (value.stagedMediaPath ? [value.stagedMediaPath] : []);
  const browserError = value.browserImageError ?? value.browserVideoError;
  if ((stagedPaths.length || browserError || value.browserRenderPlan !== undefined) && !value.outputId) context.addIssue({ code: "custom", path: ["outputId"], message: "Output id is required." });
  if (value.stagedMediaPaths && value.stagedMediaPath) context.addIssue({ code: "custom", path: ["stagedMediaPaths"], message: "Only one staged media field can be used." });
  if (browserError && stagedPaths.length) context.addIssue({ code: "custom", path: ["browserError"], message: "A browser render cannot be both completed and failed." });
  if (value.browserImageError && value.browserVideoError) context.addIssue({ code: "custom", path: ["browserVideoError"], message: "Only one browser error can be supplied." });
  if (value.caption && !stagedPaths.length) context.addIssue({ code: "custom", path: ["caption"], message: "Staged media is required." });
});

function isAuthorized(request: NextRequest) {
  return hasSocialStudioAutomationSession(request.headers.get("cookie"));
}

function isBrowserImageOutput(generator: string, mediaType: AutomationOutputRecord["media_type"]) {
  const sourceGenerator = generator.startsWith("music-") ? generator.slice("music-".length) : generator;
  return mediaType === null && BROWSER_IMAGE_GENERATORS.has(sourceGenerator);
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ errorCode: "unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ errorCode: "invalid_automation_output" }, { status: 400 });
  const ownerKey = automationOwnerKey(normalizeAutomationScope(parsed.data.scope));
  const stagedPaths = parsed.data.stagedMediaPaths ?? (parsed.data.stagedMediaPath ? [parsed.data.stagedMediaPath] : []);
  const stagedImagePaths = stagedPaths.filter((path) => path.endsWith(".png"));
  const stagedVideoPath = stagedPaths.find((path) => path.endsWith(".webm"));
  const browserError = parsed.data.browserImageError ?? parsed.data.browserVideoError;
  const browserRenderPlan = parsed.data.browserRenderPlan;
  const rendererSession = getAutomationRendererSession(request.headers.get("cookie"));

  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,media_path,media_paths,media_type,provider_task_id,upload_post_jobs,error_code,last_error_detail,last_provider,last_provider_status,last_provider_attempt_count,last_provider_request_id,attempt_count,next_attempt_at,quality_status,quality_error,lease_renderer_id,lease_expires_at,render_plan,generation_attempt_started_at,duration_recorded_at")
      .in("status", browserRenderPlan !== undefined || stagedImagePaths.length || parsed.data.browserImageError ? ["awaiting_browser_image", "awaiting_browser_video"] : stagedVideoPath || parsed.data.browserVideoError ? ["awaiting_browser_video"] : ["queued", "generating_video"])
      .lte("next_attempt_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(1);
    if (parsed.data.outputId) query = query.eq("id", parsed.data.outputId);
    const { data: candidate, error: candidateError } = await query.maybeSingle<AutomationOutputRecord>();
    if (candidateError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!candidate) return NextResponse.json({ processed: false, state: "idle" });

    const activeLease = candidate.lease_renderer_id && candidate.lease_expires_at && new Date(candidate.lease_expires_at).getTime() > Date.now();
    if (activeLease && candidate.lease_renderer_id !== rendererSession?.rendererId && (stagedPaths.length || browserError)) {
      return NextResponse.json({ processed: false, state: "leased" }, { status: 409 });
    }

    const { data: run, error: runError } = await supabase
      .from("social_content_automation_runs")
      .select("id")
      .eq("id", candidate.run_id)
      .eq("owner_key", ownerKey)
      .maybeSingle();
    if (runError) return NextResponse.json({ errorCode: "automation_runs_unavailable" }, { status: 503 });
    if (!run) return NextResponse.json({ errorCode: "automation_output_not_found" }, { status: 404 });
    if ((stagedImagePaths.length || parsed.data.browserImageError) && !isBrowserImageOutput(candidate.generator, candidate.media_type)) {
      return NextResponse.json({ errorCode: "automation_browser_image_not_expected" }, { status: 409 });
    }
    if (parsed.data.browserVideoError && isBrowserImageOutput(candidate.generator, candidate.media_type)) {
      return NextResponse.json({ errorCode: "automation_browser_video_not_expected" }, { status: 409 });
    }

    if (browserRenderPlan !== undefined) {
      const { data: persisted, error: planError } = await supabase.from("social_content_automation_outputs").update({ render_plan: browserRenderPlan, updated_at: new Date().toISOString() }).eq("id", candidate.id).eq("status", candidate.status).select("id").maybeSingle();
      if (planError) return NextResponse.json({ errorCode: "automation_output_plan_save_failed" }, { status: 503 });
      if (!persisted) return NextResponse.json({ processed: false, state: "busy" }, { status: 409 });
      return NextResponse.json({ processed: true, outputId: candidate.id, outcome: "browser_plan_saved" });
    }

    const browserCompletion = Boolean(stagedPaths.length || browserError);
    const attemptStartedAt = candidate.generation_attempt_started_at ?? new Date().toISOString();
    const update = { status: "processing", updated_at: new Date().toISOString(), lease_expires_at: null, lease_renderer_id: null, generation_attempt_started_at: attemptStartedAt };
    const { data: locked, error: lockError } = await supabase
      .from("social_content_automation_outputs")
      .update(update)
      .eq("id", candidate.id)
      .eq("status", candidate.status)
      .select("id")
      .maybeSingle();
    if (lockError) return NextResponse.json({ errorCode: "automation_output_lock_failed" }, { status: 503 });
    if (!locked) return NextResponse.json({ processed: false, state: "busy" }, { status: 409 });
    const processingCandidate = { ...candidate, generation_attempt_started_at: attemptStartedAt };

    if (browserCompletion) {
      if (browserError) {
        const browserStatus = isBrowserImageOutput(candidate.generator, candidate.media_type) ? "awaiting_browser_image" : "awaiting_browser_video";
        const recovery = await queueAutomationOutputRecovery({ ...processingCandidate, status: browserStatus }, browserError, browserStatus);
        await refreshAutomationRunStatus(candidate.run_id);
        return NextResponse.json({ processed: true, outputId: candidate.id, outcome: recovery.queued ? "recovery_queued" : "failed", errorCode: browserError });
      }

      const completed = stagedImagePaths.length
        ? {
          ...processingCandidate,
          caption: parsed.data.caption ?? candidate.caption ?? createFoxiesDeckDownloadCaption(candidate.native_language),
          media_path: stagedImagePaths[0]!,
          media_paths: stagedImagePaths.length > 1 ? stagedImagePaths : [],
          media_type: "image" as const,
        }
        : {
          ...processingCandidate,
          caption: parsed.data.caption ?? candidate.caption ?? createFoxiesDeckDownloadCaption(candidate.native_language),
          media_path: stagedVideoPath!,
          media_paths: [],
          media_type: "video" as const,
        };
      const quality = await validateAutomationOutputQuality(completed);
      if (!quality.passed) {
        const browserStatus = isBrowserImageOutput(candidate.generator, candidate.media_type) ? "awaiting_browser_image" : "awaiting_browser_video";
        await queueAutomationOutputRecovery({ ...completed, status: browserStatus }, quality.errorCode!, browserStatus);
        await refreshAutomationRunStatus(candidate.run_id);
        return NextResponse.json({ processed: true, outputId: candidate.id, outcome: "recovery_queued", errorCode: quality.errorCode });
      }

      const nextStatus = stagedImagePaths.length && candidate.generator.startsWith("music-") ? "awaiting_browser_video" : "ready_to_schedule";
      const { error: completionError } = await supabase.from("social_content_automation_outputs").update({
        status: nextStatus,
        caption: completed.caption,
        media_path: completed.media_path,
        media_paths: completed.media_paths,
        media_type: completed.media_type,
        generated_at: new Date().toISOString(),
        error_code: null,
        last_error_detail: null,
        last_provider: null,
        last_provider_status: null,
        last_provider_attempt_count: null,
        last_provider_request_id: null,
        next_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", candidate.id);
      if (completionError) return NextResponse.json({ errorCode: "automation_output_update_failed" }, { status: 503 });

      if (nextStatus === "ready_to_schedule") {
        try {
          await recordSuccessfulAutomationOutputDuration({ ...completed, status: "ready_to_schedule" });
        } catch {
          // Timing telemetry must never block a successful browser render.
        }
      }

      if (candidate.media_path?.startsWith("automation/") && !stagedPaths.includes(candidate.media_path)) {
        const { error: removeError } = await supabase.storage.from("social-studio-automation").remove([candidate.media_path]);
        if (removeError) throw new Error("automation_media_cleanup_failed");
      }
      await refreshAutomationRunStatus(candidate.run_id);
      return NextResponse.json({ processed: true, outputId: candidate.id, outcome: nextStatus === "awaiting_browser_video" ? "browser_video_required" : "content_ready" });
    }

    const result = await processAutomationOutput(processingCandidate);
    if (result.outcome === "video_pending") {
      await supabase.from("social_content_automation_outputs").update({ status: "generating_video", updated_at: new Date().toISOString() }).eq("id", candidate.id);
    }
    if (rendererSession && (result.outcome === "browser_image_required" || result.outcome === "browser_video_required")) {
      await supabase.from("social_content_automation_outputs").update({
        lease_renderer_id: rendererSession.rendererId,
        lease_expires_at: new Date(Date.now() + AUTOMATION_RENDERER_LEASE_MS).toISOString(),
        renderer_heartbeat_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", candidate.id);
    }
    await refreshAutomationRunStatus(candidate.run_id);
    return NextResponse.json({ processed: true, outputId: candidate.id, ...result });
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "automation_processing_failed";
    return NextResponse.json({ errorCode }, { status: 502 });
  }
}
