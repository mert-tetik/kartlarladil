import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { processAutomationOutput, refreshAutomationRunStatus, type AutomationOutputRecord } from "@/features/twitter-automation/automation-run-service";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { automationOwnerKey, normalizeAutomationScope } from "@/features/twitter-automation/automation-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
}).strict().superRefine((value, context) => {
  const stagedPaths = value.stagedMediaPaths ?? (value.stagedMediaPath ? [value.stagedMediaPath] : []);
  if ((stagedPaths.length || value.browserImageError) && !value.outputId) context.addIssue({ code: "custom", path: ["outputId"], message: "Output id is required." });
  if (value.stagedMediaPaths && value.stagedMediaPath) context.addIssue({ code: "custom", path: ["stagedMediaPaths"], message: "Only one staged media field can be used." });
  if (value.browserImageError && stagedPaths.length) context.addIssue({ code: "custom", path: ["browserImageError"], message: "A browser image cannot be both completed and failed." });
  if (value.caption && !stagedPaths.length) context.addIssue({ code: "custom", path: ["caption"], message: "Staged media is required." });
});

function isAuthorized(request: NextRequest) {
  return hasSocialStudioSession(request.headers.get("cookie"));
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

  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("social_content_automation_outputs")
      .select("id,run_id,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,media_path,media_paths,media_type,provider_task_id,upload_post_jobs")
      .in("status", stagedImagePaths.length || parsed.data.browserImageError ? ["awaiting_browser_image", "awaiting_browser_video"] : stagedVideoPath ? ["awaiting_browser_video"] : ["queued", "generating_video"])
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
    if ((stagedImagePaths.length || parsed.data.browserImageError) && !isBrowserImageOutput(candidate.generator, candidate.media_type)) {
      return NextResponse.json({ errorCode: "automation_browser_image_not_expected" }, { status: 409 });
    }

    const update = parsed.data.browserImageError
      ? { status: "failed", error_code: parsed.data.browserImageError, updated_at: new Date().toISOString() }
      : stagedImagePaths.length
      ? {
        status: candidate.generator.startsWith("music-") ? "awaiting_browser_video" : "ready_to_schedule",
        media_path: stagedImagePaths[0]!,
        media_paths: stagedImagePaths.length > 1 ? stagedImagePaths : [],
        media_type: "image",
        caption: parsed.data.caption ?? candidate.caption,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      : stagedVideoPath
        ? { status: "ready_to_schedule", media_path: stagedVideoPath, media_paths: [], media_type: "video", ...(parsed.data.caption ? { caption: parsed.data.caption } : {}), updated_at: new Date().toISOString() }
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

    if (stagedPaths.length && candidate.media_path?.startsWith("automation/") && !stagedPaths.includes(candidate.media_path)) {
      const { error: removeError } = await supabase.storage.from("social-studio-automation").remove([candidate.media_path]);
      if (removeError) throw new Error("automation_media_cleanup_failed");
    }

    if (stagedPaths.length || parsed.data.browserImageError) {
      await refreshAutomationRunStatus(candidate.run_id);
      return NextResponse.json({ processed: true, outputId: candidate.id, outcome: parsed.data.browserImageError ? "failed" : candidate.generator.startsWith("music-") ? "browser_video_required" : "content_ready" });
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
