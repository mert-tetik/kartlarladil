import "server-only";

import { SOCIAL_STUDIO_SESSION_COOKIE, createSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { publishWithUploadPost, type DataUrlAsset, type RemoteVideoAsset } from "@/features/twitter-automation/upload-post-publishing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LanguageCode, Tier } from "@/types/domain";
import {
  classifyAutomationError,
  isRetryableAutomationError,
  MAX_AUTOMATION_RECOVERY_ATTEMPTS,
  nextAutomationAttemptAt,
} from "@/features/twitter-automation/automation-resilience";
import { notifyAutomationRunTerminal } from "@/features/twitter-automation/automation-push-service";

const AUTOMATION_BUCKET = "social-studio-automation";
const AUTOMATION_MEDIA_PREFIX = "automation/";
const STAGED_MEDIA_URL_SECONDS = 24 * 60 * 60;
const STAGED_MEDIA_RETENTION_MS = 48 * 60 * 60 * 1000;
const SCHEDULE_OUTPUT_CONCURRENCY = 3;
const MAX_STAGED_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_STAGED_VIDEO_BYTES = 100 * 1024 * 1024;
const IMAGE_GENERATORS = ["ai-word-of-the-day", "ai-mini-quiz", "ai-false-friends", "ai-daily-challenge", "ai-vocabulary-progression", "ai-example-sentences"] as const;
const NON_AI_IMAGE_GENERATORS = ["word-of-the-day", "word-of-the-day-poster"] as const;
const SELF_IMAGE_GENERATORS = ["self-mini-quiz", "self-false-friends", "self-daily-challenge", "self-vocabulary-progression", "self-example-sentences"] as const;
const CAROUSEL_GENERATORS = ["vocabulary-carousel", "tier-progression-carousel"] as const;
const TEXT_GENERATORS = ["fun-post", "word-quiz", "language-tip", "false-friends", "daily-challenge", "relatable-learner", "tiered-vocabulary", "example-sentences"] as const;
const VIDEO_GENERATORS = ["ai-word-of-the-day-video", "confused-words-video", "marketing-dialogue-video", "learning-dialogue-video", "tier-progression-video", "vocabulary-quiz-video", "sentence-check-video", "sentence-translation-video"] as const;
const MUSIC_VIDEO_GENERATORS = [
  "music-word-of-the-day",
  "music-word-of-the-day-poster",
  "music-ai-word-of-the-day",
  "music-ai-mini-quiz",
  "music-ai-false-friends",
  "music-ai-daily-challenge",
  "music-ai-vocabulary-progression",
  "music-ai-example-sentences",
  "music-self-mini-quiz",
  "music-self-false-friends",
  "music-self-daily-challenge",
  "music-self-vocabulary-progression",
  "music-self-example-sentences",
] as const;
const IMAGE_TO_VIDEO_GENERATORS = MUSIC_VIDEO_GENERATORS;
const AI_VIDEO_GENERATORS = [
  "ai-word-of-the-day-video",
  "confused-words-video",
  "music-ai-word-of-the-day",
  "music-ai-mini-quiz",
  "music-ai-false-friends",
  "music-ai-daily-challenge",
  "music-ai-vocabulary-progression",
  "music-ai-example-sentences",
  "music-self-mini-quiz",
  "music-self-false-friends",
  "music-self-daily-challenge",
  "music-self-vocabulary-progression",
  "music-self-example-sentences",
] as const;
const TIER_OPTIONS: Tier[] = ["A1", "A2", "B1", "B2", "C1"];

type ImageGenerator = (typeof IMAGE_GENERATORS)[number];
type TextGenerator = (typeof TEXT_GENERATORS)[number];
type OutputStatus = "queued" | "processing" | "generating_video" | "awaiting_browser_image" | "awaiting_browser_video" | "ready_to_schedule" | "scheduled" | "failed";

export type AutomationOutputRecord = {
  id: string;
  run_id: string;
  content_type: "random" | "text" | "image" | "video";
  generator: string;
  language: LanguageCode;
  native_language: LanguageCode;
  tier: Tier | "random";
  scheduled_at: string;
  target_account_ids: unknown;
  status: OutputStatus;
  caption: string | null;
  media_path: string | null;
  media_paths: unknown;
  media_type: "image" | "video" | null;
  provider_task_id: string | null;
  upload_post_jobs: unknown;
  error_code?: string | null;
  attempt_count?: number;
  next_attempt_at?: string;
  quality_status?: "pending" | "passed" | "failed";
  quality_error?: string | null;
  lease_renderer_id?: string | null;
  lease_expires_at?: string | null;
  render_plan?: unknown;
};

type UploadJob = { socialMediaId: number; jobId: string | null; requestId: string | null; postUrl: string | null };

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]!;
}

function resolveTier(tier: Tier | "random") {
  return tier === "random" ? pick(TIER_OPTIONS) : tier;
}

function resolveGenerator(output: AutomationOutputRecord) {
  if (output.generator === "random-content") return pick([...TEXT_GENERATORS, ...IMAGE_GENERATORS, ...NON_AI_IMAGE_GENERATORS, ...SELF_IMAGE_GENERATORS, ...CAROUSEL_GENERATORS, ...VIDEO_GENERATORS, ...MUSIC_VIDEO_GENERATORS]);
  if (output.generator === "random-text") return pick(TEXT_GENERATORS);
  if (output.generator === "random-image") return pick([...IMAGE_GENERATORS, ...NON_AI_IMAGE_GENERATORS, ...SELF_IMAGE_GENERATORS, ...CAROUSEL_GENERATORS]);
  if (output.generator === "random-ai-image") return pick(IMAGE_GENERATORS);
  if (output.generator === "random-no-ai-image") return pick([...NON_AI_IMAGE_GENERATORS, ...SELF_IMAGE_GENERATORS, ...CAROUSEL_GENERATORS]);
  if (output.generator === "random-video") return pick([...VIDEO_GENERATORS, ...MUSIC_VIDEO_GENERATORS]);
  if (output.generator === "random-image-to-video") return pick(IMAGE_TO_VIDEO_GENERATORS);
  if (output.generator === "random-ai-video") return pick(AI_VIDEO_GENERATORS);
  return output.generator;
}

function createInternalRequest(path: string, init?: RequestInit) {
  return new Request(`http://social-studio.internal${path}`, {
    ...init,
    headers: {
      cookie: `${SOCIAL_STUDIO_SESSION_COOKIE}=${createSocialStudioSession()}`,
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}

async function readJson(response: Response) {
  return await response.json().catch(() => null) as Record<string, unknown> | null;
}

function errorCode(payload: Record<string, unknown> | null, fallback: string) {
  return typeof payload?.errorCode === "string" ? payload.errorCode : fallback;
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/u);
  if (!match) throw new Error("invalid_generated_image");
  return { mimeType: match[1] as DataUrlAsset["mimeType"], data: Buffer.from(match[2], "base64") };
}

async function storeGeneratedImage(dataUrl: string, outputId: string, suffix?: string) {
  const image = parseDataUrl(dataUrl);
  if (!image.data.length || image.data.length > MAX_STAGED_IMAGE_BYTES) throw new Error("generated_image_too_large");
  const extension = image.mimeType === "image/png" ? "png" : image.mimeType === "image/jpeg" ? "jpg" : "webp";
  const path = `${AUTOMATION_MEDIA_PREFIX}${outputId}${suffix ? `-${suffix}` : ""}.${extension}`;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(AUTOMATION_BUCKET).upload(path, image.data, {
    contentType: image.mimeType,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error("automation_media_store_failed");
  return path;
}

function videoMimeType(contentType: string | null, sourceUrl: string) {
  if (contentType === "video/webm" || /\.webm(?:$|[?#])/iu.test(sourceUrl)) return "video/webm" as const;
  return "video/mp4" as const;
}

async function storeGeneratedVideo(sourceUrl: string, outputId: string) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error("generated_video_download_failed");

  const expectedSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(expectedSize) && expectedSize > MAX_STAGED_VIDEO_BYTES) throw new Error("generated_video_too_large");
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > MAX_STAGED_VIDEO_BYTES) throw new Error("generated_video_too_large");

  const mimeType = videoMimeType(response.headers.get("content-type")?.split(";", 1)[0] ?? null, sourceUrl);
  const path = `${AUTOMATION_MEDIA_PREFIX}${outputId}.${mimeType === "video/webm" ? "webm" : "mp4"}`;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(AUTOMATION_BUCKET).upload(path, data, {
    contentType: mimeType,
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error("automation_media_store_failed");
  return { path, mimeType };
}

async function readStoredImage(path: string): Promise<DataUrlAsset> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).download(path);
  if (error || !data) throw new Error("automation_media_read_failed");
  const mimeType = data.type === "image/png" || data.type === "image/jpeg" || data.type === "image/webp" ? data.type : "image/webp";
  return { mimeType, dataUrl: `data:${mimeType};base64,${Buffer.from(await data.arrayBuffer()).toString("base64")}` };
}

async function createStagedVideoUrl(path: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).createSignedUrl(path, STAGED_MEDIA_URL_SECONDS);
  if (error || !data?.signedUrl) throw new Error("automation_media_url_failed");
  return data.signedUrl;
}

function asAccountIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => typeof item === "number" && Number.isInteger(item) && item > 0 ? [item] : []);
}

function asUploadJobs(value: unknown): UploadJob[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const job = item as Partial<UploadJob>;
    return typeof job.socialMediaId === "number" && Number.isInteger(job.socialMediaId) ? [{
      socialMediaId: job.socialMediaId,
      jobId: typeof job.jobId === "string" ? job.jobId : null,
      requestId: typeof job.requestId === "string" ? job.requestId : null,
      postUrl: typeof job.postUrl === "string" ? job.postUrl : null,
    }] : [];
  });
}

async function updateOutput(outputId: string, patch: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("social_content_automation_outputs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", outputId);
  if (error) throw new Error("automation_output_update_failed");
}

async function createText(output: AutomationOutputRecord, generator: TextGenerator) {
  const { POST: createFunPost } = await import("@/app/api/twitter-automation/fun-post/route");
  const response = await createFunPost(createInternalRequest("/api/twitter-automation/fun-post", {
    method: "POST",
    body: JSON.stringify({ mode: generator, language: output.language, nativeLanguage: output.native_language }),
  }));
  const payload = await readJson(response);
  if (!response.ok || typeof payload?.post !== "string" || !payload.post.trim()) throw new Error(errorCode(payload, "text_generation_failed"));
  return payload.post.trim();
}

async function createImage(output: AutomationOutputRecord, generator: ImageGenerator, tier: Tier) {
  const { POST: createAiImage } = await import("@/app/api/twitter-automation/ai-image/route");
  const response = await createAiImage(createInternalRequest("/api/twitter-automation/ai-image", {
    method: "POST",
    body: JSON.stringify({ mode: generator, language: output.language, nativeLanguage: output.native_language, tier }),
  }));
  const payload = await readJson(response);
  if (!response.ok || typeof payload?.imageUrl !== "string" || typeof payload.caption !== "string") throw new Error(errorCode(payload, "image_generation_failed"));
  return { caption: payload.caption.trim(), mediaPath: await storeGeneratedImage(payload.imageUrl, output.id) };
}

async function prepareBrowserImage(output: AutomationOutputRecord, tier: Tier) {
  await updateOutput(output.id, {
    status: "awaiting_browser_image",
    tier,
    caption: null,
    media_path: null,
    media_paths: [],
    media_type: null,
    generated_at: new Date().toISOString(),
    error_code: null,
  });
  return "browser_image_required";
}

function hasNonEmptyCaption(caption: string | null) {
  return Boolean(caption?.trim() && caption.trim().length <= 400);
}

async function validateStoredMedia(path: string, type: "image" | "video") {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).download(path);
  if (error || !data) throw new Error("automation_quality_storage_unavailable");
  const size = data.size;
  if (!size) throw new Error("automation_quality_media_empty");
  if (type === "image") {
    if (!data.type.startsWith("image/") || size > MAX_STAGED_IMAGE_BYTES) throw new Error("automation_quality_image_invalid");
  } else if (!data.type.startsWith("video/") || size > MAX_STAGED_VIDEO_BYTES) {
    throw new Error("automation_quality_video_invalid");
  }
}

export async function validateAutomationOutputQuality(output: AutomationOutputRecord) {
  try {
    if (!hasNonEmptyCaption(output.caption)) throw new Error("automation_quality_caption_invalid");
    if (output.content_type !== "text") {
      if (!output.media_type) throw new Error("automation_quality_media_missing");
      const paths = output.media_type === "image" ? (asMediaPaths(output.media_paths).length ? asMediaPaths(output.media_paths) : output.media_path ? [output.media_path] : []) : output.media_path ? [output.media_path] : [];
      if (!paths.length) throw new Error("automation_quality_media_missing");
      await Promise.all(paths.map((path) => validateStoredMedia(path, output.media_type!)));
    }
    await updateOutput(output.id, { quality_status: "passed", quality_error: null, quality_checked_at: new Date().toISOString() });
    return { passed: true as const };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "automation_quality_failed";
    await updateOutput(output.id, { quality_status: "failed", quality_error: errorCode, quality_checked_at: new Date().toISOString() });
    return { passed: false as const, errorCode };
  }
}

export async function queueAutomationOutputRecovery(output: AutomationOutputRecord, code: string, fallbackStatus?: OutputStatus) {
  const attemptCount = (output.attempt_count ?? 0) + 1;
  const retryable = isRetryableAutomationError(code);
  const exhausted = !retryable || attemptCount >= MAX_AUTOMATION_RECOVERY_ATTEMPTS;
  const errorClass = classifyAutomationError(code);
  const now = new Date().toISOString();
  if (exhausted) {
    await updateOutput(output.id, {
      status: "failed",
      error_code: code,
      last_error_class: errorClass,
      attempt_count: attemptCount,
      retry_exhausted_at: now,
      next_attempt_at: now,
      lease_renderer_id: null,
      lease_expires_at: null,
    });
    return { queued: false as const, exhausted: true as const, attemptCount };
  }

  const status = fallbackStatus ?? (output.status === "awaiting_browser_image" || output.status === "awaiting_browser_video" ? output.status : output.status === "generating_video" && output.provider_task_id ? "generating_video" : "queued");
  await updateOutput(output.id, {
    status,
    error_code: code,
    last_error_class: errorClass,
    attempt_count: attemptCount,
    next_attempt_at: nextAutomationAttemptAt(attemptCount),
    lease_renderer_id: null,
    lease_expires_at: null,
  });
  return { queued: true as const, exhausted: false as const, attemptCount };
}

async function makeAutomationOutputReady(output: AutomationOutputRecord, patch: Record<string, unknown> = {}) {
  const readyOutput = { ...output, ...patch } as AutomationOutputRecord;
  const quality = await validateAutomationOutputQuality(readyOutput);
  if (!quality.passed) {
    await queueAutomationOutputRecovery(readyOutput, quality.errorCode!);
    return false;
  }
  await updateOutput(output.id, {
    ...patch,
    status: "ready_to_schedule",
    error_code: null,
    next_attempt_at: new Date().toISOString(),
    lease_renderer_id: null,
    lease_expires_at: null,
  });
  return true;
}

async function prepareMusicVideo(output: AutomationOutputRecord, generator: (typeof MUSIC_VIDEO_GENERATORS)[number], tier: Tier) {
  const sourceGenerator = generator.slice("music-".length);
  if ((NON_AI_IMAGE_GENERATORS as readonly string[]).includes(sourceGenerator) || (SELF_IMAGE_GENERATORS as readonly string[]).includes(sourceGenerator)) {
    return prepareBrowserImage(output, tier);
  }
  const source = (IMAGE_GENERATORS as readonly string[]).includes(sourceGenerator)
    ? await createImage(output, sourceGenerator as ImageGenerator, tier)
    : null;
  if (!source) throw new Error("unsupported_music_video_generator");
  await updateOutput(output.id, {
    status: "awaiting_browser_video",
    caption: source.caption,
    media_path: source.mediaPath,
    media_paths: [],
    media_type: "image",
    generated_at: new Date().toISOString(),
    error_code: null,
  });
  return "browser_video_required";
}

async function prepareBrowserVideo(output: AutomationOutputRecord, tier: Tier) {
  await updateOutput(output.id, {
    status: "awaiting_browser_video",
    tier,
    caption: null,
    media_path: null,
    media_paths: [],
    media_type: null,
    generated_at: new Date().toISOString(),
    error_code: null,
  });
  return "browser_video_required";
}

async function startVideo(output: AutomationOutputRecord, tier: Tier) {
  const { POST: createAiVideo } = await import("@/app/api/twitter-automation/ai-video/route");
  const response = await createAiVideo(createInternalRequest("/api/twitter-automation/ai-video", {
    method: "POST",
    body: JSON.stringify({ language: output.language, nativeLanguage: output.native_language, tier }),
  }));
  const payload = await readJson(response);
  if (!response.ok || typeof payload?.taskId !== "string" || typeof payload.caption !== "string") throw new Error(errorCode(payload, "video_generation_failed"));
  const firstFrame = typeof payload.firstFrameUrl === "string" ? await storeGeneratedImage(payload.firstFrameUrl, `${output.id}-preview`) : null;
  await updateOutput(output.id, {
    status: "generating_video",
    provider_task_id: payload.taskId,
    caption: payload.caption.trim(),
    media_path: firstFrame,
    media_paths: [],
    media_type: "image",
    generated_at: new Date().toISOString(),
    error_code: null,
  });
  return "video_started";
}

async function resolveVideo(output: AutomationOutputRecord) {
  if (!output.provider_task_id) throw new Error("video_task_missing");
  const { GET: getAiVideoStatus } = await import("@/app/api/twitter-automation/ai-video/route");
  const response = await getAiVideoStatus(createInternalRequest(`/api/twitter-automation/ai-video?taskId=${encodeURIComponent(output.provider_task_id)}`));
  const payload = await readJson(response);
  if (!response.ok) throw new Error(errorCode(payload, "video_status_failed"));
  if (payload?.status === "failed") throw new Error("video_generation_failed");
  if (payload?.status !== "finished" || typeof payload.videoUrl !== "string" || !payload.videoUrl.startsWith("https://")) return { state: "video_pending" as const };
  const video = await storeGeneratedVideo(payload.videoUrl, output.id);
  if (output.media_path?.startsWith(AUTOMATION_MEDIA_PREFIX)) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from(AUTOMATION_BUCKET).remove([output.media_path]);
    if (error) throw new Error("automation_media_cleanup_failed");
  }
  await updateOutput(output.id, { media_path: video.path, media_paths: [], media_type: "video", error_code: null });
  return { state: "video_ready" as const, path: video.path };
}

async function scheduleOutput(output: AutomationOutputRecord) {
  const accountIds = asAccountIds(output.target_account_ids);
  if (!accountIds.length) throw new Error("automation_target_missing");
  if (!output.caption) throw new Error("automation_caption_missing");

  let asset: DataUrlAsset | RemoteVideoAsset | undefined;
  let assets: DataUrlAsset[] | undefined;
  if (output.media_type === "image") {
    const mediaPaths = asMediaPaths(output.media_paths);
    if (mediaPaths.length) {
      assets = await Promise.all(mediaPaths.map(readStoredImage));
    } else {
      if (!output.media_path) throw new Error("automation_media_missing");
      asset = await readStoredImage(output.media_path);
    }
  } else if (output.media_type === "video") {
    if (!output.media_path) throw new Error("automation_media_missing");
    const sourceUrl = output.media_path.startsWith("https://") ? output.media_path : await createStagedVideoUrl(output.media_path);
    asset = { sourceUrl, mimeType: videoMimeType(null, output.media_path) };
  }

  const jobs = asUploadJobs(output.upload_post_jobs);
  const scheduledIds = new Set(jobs.map((job) => job.socialMediaId));
  for (const socialMediaId of accountIds) {
    if (scheduledIds.has(socialMediaId)) continue;
    const result = await publishWithUploadPost({
      socialMediaId,
      caption: output.caption,
      asset,
      assets,
      scheduledFor: output.scheduled_at,
      requestId: `automation-${output.id}-${socialMediaId}`,
    });
    jobs.push({ socialMediaId, jobId: result.jobId, requestId: result.requestId, postUrl: result.postUrl });
    await updateOutput(output.id, { upload_post_jobs: jobs });
  }

  await updateOutput(output.id, {
    status: "scheduled",
    upload_post_jobs: jobs,
    scheduled_at_upload_post: new Date().toISOString(),
    error_code: null,
  });
  return "scheduled";
}

function asMediaPaths(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((path): path is string => typeof path === "string" && path.startsWith(AUTOMATION_MEDIA_PREFIX)))];
}

export async function scheduleReadyAutomationRun(runId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: allOutputs, error: readinessError } = await supabase
    .from("social_content_automation_outputs")
    .select("id,status,quality_status")
    .eq("run_id", runId);
  if (readinessError) throw new Error("automation_schedule_readiness_failed");
  const blockedOutputs = (allOutputs ?? []).filter((output) => output.status !== "ready_to_schedule" && output.status !== "scheduled");
  const failedQuality = (allOutputs ?? []).filter((output) => output.status === "ready_to_schedule" && output.quality_status !== "passed");
  if (blockedOutputs.length || failedQuality.length) {
    return { scheduled: 0, failed: 0, blocked: true, pending: blockedOutputs.length + failedQuality.length };
  }

  await supabase.from("social_content_automation_runs").update({ auto_schedule_started_at: new Date().toISOString(), auto_schedule_error: null }).eq("id", runId);
  const { data: lockedOutputs, error: lockError } = await supabase
    .from("social_content_automation_outputs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("run_id", runId)
    .eq("status", "ready_to_schedule")
    .eq("quality_status", "passed")
    .select("id,run_id,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,media_path,media_paths,media_type,provider_task_id,upload_post_jobs,error_code,attempt_count,next_attempt_at,quality_status,quality_error,lease_renderer_id,lease_expires_at")
    .returns<AutomationOutputRecord[]>();
  if (lockError) throw new Error("automation_schedule_lock_failed");

  let scheduled = 0;
  let failed = 0;
  let nextOutputIndex = 0;
  const outputsToSchedule = lockedOutputs ?? [];
  const worker = async () => {
    while (nextOutputIndex < outputsToSchedule.length) {
      const output = outputsToSchedule[nextOutputIndex++];
      if (!output) continue;
      try {
        await scheduleOutput({ ...output, status: "processing" });
        scheduled += 1;
      } catch (error) {
        failed += 1;
        try {
          await updateOutput(output.id, {
            status: "failed",
            error_code: error instanceof Error ? error.message : "automation_schedule_failed",
          });
        } catch {
          // The stale-processing recovery path will safely return this output to the queue.
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SCHEDULE_OUTPUT_CONCURRENCY, outputsToSchedule.length) }, () => worker()));

  if (failed) {
    await supabase.from("social_content_automation_runs").update({ auto_schedule_error: "automation_schedule_partial_failure" }).eq("id", runId);
  } else {
    await supabase.from("social_content_automation_runs").update({ auto_schedule_completed_at: new Date().toISOString(), auto_schedule_error: null }).eq("id", runId);
  }
  await refreshAutomationRunStatus(runId, { autoSchedule: false });
  return { scheduled, failed, blocked: false, pending: 0 };
}

export async function processAutomationOutput(output: AutomationOutputRecord) {
  try {
    if (output.status === "generating_video") {
      const videoState = await resolveVideo(output);
      if (videoState.state === "video_pending") return { outcome: "video_pending" as const };
      const ready = await makeAutomationOutputReady({ ...output, media_path: videoState.path, media_paths: [], media_type: "video" }, { media_path: videoState.path, media_paths: [], media_type: "video" });
      return ready ? { outcome: "content_ready" as const } : { outcome: "recovery_queued" as const };
    }

    const generator = resolveGenerator(output);
    const tier = resolveTier(output.tier);
    if ((TEXT_GENERATORS as readonly string[]).includes(generator)) {
      const caption = await createText(output, generator as TextGenerator);
      const ready = await makeAutomationOutputReady({ ...output, caption }, { caption, generated_at: new Date().toISOString() });
      return ready ? { outcome: "content_ready" as const } : { outcome: "recovery_queued" as const };
    }
    if ((IMAGE_GENERATORS as readonly string[]).includes(generator)) {
      const generated = await createImage(output, generator as ImageGenerator, tier);
      const ready = await makeAutomationOutputReady({ ...output, caption: generated.caption, media_path: generated.mediaPath, media_paths: [], media_type: "image" }, { caption: generated.caption, media_path: generated.mediaPath, media_paths: [], media_type: "image", generated_at: new Date().toISOString() });
      return ready ? { outcome: "content_ready" as const } : { outcome: "recovery_queued" as const };
    }
    if ((NON_AI_IMAGE_GENERATORS as readonly string[]).includes(generator) || (SELF_IMAGE_GENERATORS as readonly string[]).includes(generator) || (CAROUSEL_GENERATORS as readonly string[]).includes(generator)) {
      return { outcome: await prepareBrowserImage(output, tier) };
    }
    if (generator === "ai-word-of-the-day-video") return { outcome: await startVideo(output, tier) };
    if ((VIDEO_GENERATORS as readonly string[]).includes(generator)) return { outcome: await prepareBrowserVideo(output, tier) };
    if ((MUSIC_VIDEO_GENERATORS as readonly string[]).includes(generator)) return { outcome: await prepareMusicVideo(output, generator as (typeof MUSIC_VIDEO_GENERATORS)[number], tier) };
    throw new Error("unsupported_automation_generator");
  } catch (error) {
    const code = error instanceof Error ? error.message : "automation_processing_failed";
    const recovery = await queueAutomationOutputRecovery(output, code);
    return recovery.queued ? { outcome: "recovery_queued" as const, errorCode: code } : { outcome: "failed" as const, errorCode: code };
  }
}

export async function refreshAutomationRunStatus(runId: string, options: { autoSchedule?: boolean } = {}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("social_content_automation_outputs").select("status").eq("run_id", runId);
  if (error) throw new Error("automation_run_status_failed");
  const statuses = (data ?? []).map((item) => item.status as OutputStatus);
  if (statuses.some((status) => status === "queued" || status === "processing" || status === "generating_video" || status === "awaiting_browser_image" || status === "awaiting_browser_video")) {
    await supabase.from("social_content_automation_runs").update({ status: "processing" }).eq("id", runId);
    return;
  }
  if (statuses.some((status) => status === "ready_to_schedule")) {
    const { data: run, error: runError } = await supabase
      .from("social_content_automation_runs")
      .select("owner_key,auto_schedule_on_success")
      .eq("id", runId)
      .maybeSingle<{ owner_key: string; auto_schedule_on_success: boolean }>();
    if (runError) throw new Error("automation_run_status_failed");
    await supabase.from("social_content_automation_runs").update({ status: "ready_to_schedule", completed_at: null }).eq("id", runId);
    const allReady = statuses.every((status) => status === "ready_to_schedule" || status === "scheduled");
    if (options.autoSchedule !== false && allReady && run?.owner_key === "social-studio" && run.auto_schedule_on_success) {
      await scheduleReadyAutomationRun(runId);
    }
    return;
  }
  const terminalStatus = statuses.some((status) => status === "failed") ? "completed_with_errors" : "completed";
  const { data: existingRun } = await supabase.from("social_content_automation_runs").select("owner_key,status").eq("id", runId).maybeSingle<{ owner_key: string; status: string }>();
  await supabase.from("social_content_automation_runs").update({
    status: terminalStatus,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
  if (existingRun?.owner_key === "social-studio" && existingRun.status !== terminalStatus) {
    await notifyAutomationRunTerminal(existingRun.owner_key, terminalStatus).catch(() => undefined);
  }
}

export async function cleanupStagedAutomationMedia(now = new Date()) {
  const cutoff = new Date(now.getTime() - STAGED_MEDIA_RETENTION_MS).toISOString();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_content_automation_outputs")
    .select("id,media_path,media_paths")
    .eq("status", "scheduled")
    .lt("scheduled_at_upload_post", cutoff)
    .limit(100);
  if (error) throw new Error("automation_media_cleanup_query_failed");

  const staleOutputs = (data ?? []).map((output) => ({
    id: output.id,
    paths: [...new Set([
      typeof output.media_path === "string" && output.media_path.startsWith(AUTOMATION_MEDIA_PREFIX) ? output.media_path : null,
      ...asMediaPaths(output.media_paths),
    ].filter((path): path is string => Boolean(path)))],
  })).filter((output) => output.paths.length);
  if (!staleOutputs.length) return { removed: 0 };

  const paths = [...new Set(staleOutputs.flatMap((output) => output.paths))];
  const { error: removeError } = await supabase.storage.from(AUTOMATION_BUCKET).remove(paths);
  if (removeError) throw new Error("automation_media_cleanup_failed");

  const { error: updateError } = await supabase
    .from("social_content_automation_outputs")
    .update({ media_path: null, media_paths: [], media_type: null, updated_at: now.toISOString() })
    .in("id", staleOutputs.map((output) => output.id));
  if (updateError) throw new Error("automation_media_cleanup_update_failed");
  return { removed: staleOutputs.length };
}
