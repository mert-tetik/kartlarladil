import "server-only";

import { SOCIAL_AUTOMATION_INTERNAL_SESSION_COOKIE, createSocialAutomationInternalSession } from "@/features/twitter-automation/social-studio-auth";
import { publishWithUploadPost, type DataUrlAsset, type RemoteVideoAsset } from "@/features/twitter-automation/upload-post-publishing";
import { UploadPostRejectedError } from "@/features/twitter-automation/upload-post-provider-error";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LanguageCode, Tier } from "@/types/domain";
import {
  classifyAutomationError,
  isRetryableAutomationError,
  MAX_AUTOMATION_RECOVERY_ATTEMPTS,
  nextAutomationAttemptAt,
} from "@/features/twitter-automation/automation-resilience";
import { createFoxiesDeckDownloadCaption, getSocialDownloadTitle } from "@/features/twitter-automation/social-video-titles";
import { getSocialStudioProviderFailureDetails, getSocialStudioResponsesErrorCode } from "@/features/twitter-automation/social-studio-poyo";
import { renderServerMusicVideo } from "@/features/twitter-automation/server-music-video-renderer";
import { mergeDailyAutomationOutputMetadata, readDailyAutomationOutputMetadata, type DailyAutomationOutputMetadata } from "@/features/twitter-automation/daily-automation-output";
import { AUTOMATION_SCHEDULE_MIN_LEAD_MS, isAutomationScheduleExpired, resolveAutomationScheduleAt, type AutomationScheduleReservation } from "@/features/twitter-automation/automation-schedule-policy";
import { UPLOAD_POST_REQUEST_RECHECK_DELAY_MS, UPLOAD_POST_REQUEST_UNCONFIRMED_CODE } from "@/features/twitter-automation/upload-post-schedule-constants";
import { getAutomationScheduleFailureReason, isScheduleErrorEligible, SCHEDULE_RETRY_ERROR_OR_FILTER } from "@/features/twitter-automation/automation-schedule-errors";
import { AUTOMATION_SCHEDULE_BATCH_SIZE } from "@/features/twitter-automation/automation-schedule-batches";

const AUTOMATION_BUCKET = "social-studio-automation";
const AUTOMATION_MEDIA_PREFIX = "automation/";
const STAGED_MEDIA_URL_SECONDS = 24 * 60 * 60;
const STORAGE_PAGE_SIZE = 1000;
const SCHEDULE_OUTPUT_CONCURRENCY = 3;
const DEFINITIVE_SCHEDULE_FAILURE_CODES = new Set([
  "account_not_found",
  "automation_caption_missing",
  "automation_media_missing",
  "automation_media_read_failed",
  "automation_media_store_failed",
  "automation_media_url_failed",
  "automation_target_missing",
  "invalid_media",
  "invalid_scheduled_date",
  "upload_post_carousel_limit",
  "upload_post_not_configured",
  "upload_post_profile_not_configured",
  "upload_post_rate_limited",
  "upload_post_reddit_unavailable",
  "upload_post_unsupported_content",
]);
const MAX_STAGED_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_STAGED_VIDEO_BYTES = 100 * 1024 * 1024;
const IMAGE_GENERATORS = ["ai-word-of-the-day", "ai-mini-quiz", "ai-false-friends", "ai-daily-challenge", "ai-vocabulary-progression", "ai-example-sentences"] as const;
const NON_AI_IMAGE_GENERATORS = ["word-of-the-day", "word-of-the-day-poster"] as const;
const SELF_IMAGE_GENERATORS = ["self-mini-quiz", "self-false-friends", "self-daily-challenge", "self-vocabulary-progression", "self-example-sentences"] as const;
const CAROUSEL_GENERATORS = ["vocabulary-carousel", "tier-progression-carousel"] as const;
const TEXT_GENERATORS = ["word-of-the-day-text", "fun-post", "word-quiz", "language-tip", "false-friends", "daily-challenge", "relatable-learner", "tiered-vocabulary", "example-sentences"] as const;
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
type OutputStatus = "queued" | "processing" | "generating_video" | "awaiting_browser_image" | "awaiting_browser_video" | "ready_to_schedule" | "scheduled" | "failed" | "skipped";
type ScheduleStatus = "pending" | "processing" | "partially_scheduled" | "failed" | "scheduled";

type AiImagePlan = {
  artDirection: string;
  caption: string;
  falseFriend?: {
    firstTerm: string;
    secondTerm: string;
    firstMeaning: string;
    secondMeaning: string;
  };
};

type StoredAiImagePlan = AiImagePlan & {
  kind: "ai-image";
  generator: ImageGenerator;
  tier: Tier;
};

type GeneratedImage = {
  caption: string;
  mediaPath: string;
  plan: StoredAiImagePlan;
};

export type AutomationOutputRecord = {
  id: string;
  run_id: string;
  generation_key?: string | null;
  generation_date?: string | null;
  generation_index?: number | null;
  day_offset?: number;
  group_name?: string;
  content_type: "random" | "text" | "image" | "video";
  generator: string;
  language: LanguageCode;
  native_language: LanguageCode;
  tier: Tier | "random";
  scheduled_at: string;
  target_account_ids: unknown;
  status: OutputStatus;
  title?: string | null;
  description?: string | null;
  caption: string | null;
  media_path: string | null;
  media_paths: unknown;
  media_type: "image" | "video" | null;
  provider_task_id: string | null;
  upload_post_jobs: unknown;
  schedule_status?: ScheduleStatus;
  schedule_error_code?: string | null;
  schedule_error_detail?: string | null;
  schedule_attempt_count?: number;
  schedule_attempted_at?: string | null;
  schedule_completed_at?: string | null;
  error_code?: string | null;
  last_error_detail?: string | null;
  last_provider?: "poyo" | "openai" | null;
  last_provider_status?: number | null;
  last_provider_attempt_count?: number | null;
  last_provider_request_id?: string | null;
  attempt_count?: number;
  next_attempt_at?: string;
  quality_status?: "pending" | "passed" | "failed";
  quality_error?: string | null;
  lease_renderer_id?: string | null;
  lease_expires_at?: string | null;
  render_plan?: unknown;
  generation_attempt_started_at?: string | null;
  duration_recorded_at?: string | null;
};

type UploadJob = {
  socialMediaId: number;
  jobId: string | null;
  status?: "processing" | "scheduled" | "failed";
  requestId: string | null;
  idempotencyKey?: string | null;
  postUrl: string | null;
  scheduledAt: string | null;
  externalId?: string | null;
  attemptedScheduledAt?: string[];
  requestStartedAt?: string | null;
  lastProviderCheckedAt?: string | null;
  requestRecoveryAttemptCount?: number;
  manualReviewRequired?: boolean;
};

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
      cookie: `${SOCIAL_AUTOMATION_INTERNAL_SESSION_COOKIE}=${createSocialAutomationInternalSession()}`,
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

type AutomationProviderDiagnostic = {
  provider: "poyo" | "openai";
  status: number | null;
  attemptCount: number | null;
  requestId: string | null;
  detail: string;
};

type AutomationRouteFailure = Error & {
  providerDiagnostic?: AutomationProviderDiagnostic;
};

function providerDiagnosticFromPayload(payload: Record<string, unknown> | null): AutomationProviderDiagnostic | null {
  const diagnostic = payload?.diagnostic;
  if (!diagnostic || typeof diagnostic !== "object" || Array.isArray(diagnostic)) return null;
  const record = diagnostic as Record<string, unknown>;
  const providerLabel = typeof record.provider === "string" ? record.provider : "";
  const provider = /openai/iu.test(providerLabel) ? "openai" : /poyo/iu.test(providerLabel) ? "poyo" : null;
  const detail = typeof record.detail === "string" ? record.detail.trim().slice(0, 320) : "";
  if (!provider || !detail) return null;
  const status = typeof record.providerStatus === "number" && Number.isInteger(record.providerStatus) && record.providerStatus >= 100 && record.providerStatus <= 599
    ? record.providerStatus
    : null;
  const attemptCount = typeof record.attemptCount === "number" && Number.isInteger(record.attemptCount) && record.attemptCount >= 1 && record.attemptCount <= 3
    ? record.attemptCount
    : null;
  const requestId = typeof record.providerRequestId === "string" && /^req_[A-Za-z0-9_-]{8,}$/u.test(record.providerRequestId)
    ? record.providerRequestId
    : null;
  return { provider, status, attemptCount, requestId, detail };
}

function automationRouteFailure(payload: Record<string, unknown> | null, fallback: string): AutomationRouteFailure {
  const failure = new Error(errorCode(payload, fallback)) as AutomationRouteFailure;
  const diagnostic = providerDiagnosticFromPayload(payload);
  if (diagnostic) failure.providerDiagnostic = diagnostic;
  return failure;
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

async function storeGeneratedVideoBuffer(data: Buffer, outputId: string) {
  if (!data.length || data.length > MAX_STAGED_VIDEO_BYTES) throw new Error("generated_video_too_large");
  const path = `${AUTOMATION_MEDIA_PREFIX}${outputId}.mp4`;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(AUTOMATION_BUCKET).upload(path, data, {
    contentType: "video/mp4",
    cacheControl: "31536000",
    upsert: true,
  });
  if (error) throw new Error("automation_media_store_failed");
  return { path, mimeType: "video/mp4" as const };
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
  return [...new Set(value.flatMap((item) => typeof item === "number" && Number.isInteger(item) && item > 0 ? [item] : []))];
}

function asUploadJobs(value: unknown): UploadJob[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const job = item as Partial<UploadJob>;
    return typeof job.socialMediaId === "number" && Number.isInteger(job.socialMediaId) ? [{
      socialMediaId: job.socialMediaId,
      jobId: typeof job.jobId === "string" ? job.jobId : null,
      status: job.status === "processing" || job.status === "scheduled" || job.status === "failed"
        ? job.status
        : typeof job.jobId === "string" ? "scheduled" : job.requestId || job.idempotencyKey ? "processing" : "failed",
      requestId: typeof job.requestId === "string" ? job.requestId : null,
      idempotencyKey: typeof job.idempotencyKey === "string" ? job.idempotencyKey : null,
      postUrl: typeof job.postUrl === "string" ? job.postUrl : null,
      scheduledAt: typeof job.scheduledAt === "string" ? job.scheduledAt : null,
      externalId: typeof job.externalId === "string" ? job.externalId : null,
      attemptedScheduledAt: Array.isArray(job.attemptedScheduledAt)
        ? job.attemptedScheduledAt.filter((value): value is string => typeof value === "string")
        : [],
      requestStartedAt: typeof job.requestStartedAt === "string" ? job.requestStartedAt : null,
      lastProviderCheckedAt: typeof job.lastProviderCheckedAt === "string" ? job.lastProviderCheckedAt : null,
      requestRecoveryAttemptCount: typeof job.requestRecoveryAttemptCount === "number" && Number.isSafeInteger(job.requestRecoveryAttemptCount) && job.requestRecoveryAttemptCount >= 0
        ? job.requestRecoveryAttemptCount
        : undefined,
      manualReviewRequired: job.manualReviewRequired === true,
    }] : [];
  });
}

async function updateOutput(outputId: string, patch: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();
  const durablePatch = { ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "caption") && !Object.prototype.hasOwnProperty.call(patch, "description")) {
    // `caption` is the legacy durable description column and is available on
    // every deployed automation schema.
  }
  if (Object.prototype.hasOwnProperty.call(patch, "description") && !Object.prototype.hasOwnProperty.call(patch, "caption")) {
    durablePatch.caption = patch.description;
  }
  delete durablePatch.description;
  delete durablePatch.title;

  const patchMetadata = readDailyAutomationOutputMetadata(patch.render_plan);
  const needsMetadataUpdate = Boolean(patchMetadata || typeof patch.title === "string" || typeof patch.description === "string" || typeof patch.caption === "string");
  if (needsMetadataUpdate) {
    const current = await supabase
      .from("social_content_automation_outputs")
      .select("render_plan")
      .eq("id", outputId)
      .maybeSingle<{ render_plan: unknown }>();
    if (current.error) throw new Error("automation_output_metadata_read_failed");
    const existingMetadata = readDailyAutomationOutputMetadata(current.data?.render_plan);
    const metadata: DailyAutomationOutputMetadata | null = patchMetadata ?? existingMetadata
      ? {
        ...(patchMetadata ?? existingMetadata!),
        ...(typeof patch.title === "string" ? { title: patch.title } : {}),
        ...(typeof patch.description === "string" ? { description: patch.description } : typeof patch.caption === "string" ? { description: patch.caption } : {}),
      }
      : null;
    if (metadata) durablePatch.render_plan = mergeDailyAutomationOutputMetadata(patch.render_plan ?? current.data?.render_plan, metadata);
  }
  const { error } = await supabase.from("social_content_automation_outputs").update({ ...durablePatch, updated_at: new Date().toISOString() }).eq("id", outputId);
  if (error) throw new Error("automation_output_update_failed");
}

async function createText(output: AutomationOutputRecord, generator: TextGenerator) {
  const { POST: createFunPost } = await import("@/app/api/twitter-automation/fun-post/route");
  const response = await createFunPost(createInternalRequest("/api/twitter-automation/fun-post", {
    method: "POST",
    body: JSON.stringify({ mode: generator, language: output.language, nativeLanguage: output.native_language }),
  }));
  const payload = await readJson(response);
  if (!response.ok || typeof payload?.post !== "string" || !payload.post.trim()) throw automationRouteFailure(payload, "text_generation_failed");
  return payload.post.trim();
}

function parseAiImagePlan(value: unknown): AiImagePlan | null {
  if (!value || typeof value !== "object") return null;
  const plan = value as Partial<AiImagePlan>;
  const artDirection = typeof plan.artDirection === "string" ? plan.artDirection.trim() : "";
  const caption = typeof plan.caption === "string" ? plan.caption.trim() : "";
  if (artDirection.length < 40 || caption.length < 12) return null;
  const falseFriend = plan.falseFriend;
  const hasFalseFriend = Boolean(falseFriend
    && typeof falseFriend.firstTerm === "string"
    && typeof falseFriend.secondTerm === "string"
    && typeof falseFriend.firstMeaning === "string"
    && typeof falseFriend.secondMeaning === "string");
  return {
    artDirection: artDirection.slice(0, 5_000),
    caption: caption.slice(0, 400),
    ...(hasFalseFriend ? { falseFriend: falseFriend! } : {}),
  };
}

function getStoredAiImagePlan(output: AutomationOutputRecord, generator: ImageGenerator): StoredAiImagePlan | null {
  if (!output.render_plan || typeof output.render_plan !== "object") return null;
  const stored = output.render_plan as Partial<StoredAiImagePlan>;
  if (output.tier === "random" || stored.kind !== "ai-image" || stored.generator !== generator || stored.tier !== output.tier) return null;
  const plan = parseAiImagePlan(stored);
  if (!plan || (generator === "ai-false-friends" && !plan.falseFriend)) return null;
  return { ...plan, kind: "ai-image", generator, tier: output.tier };
}

async function createImage(output: AutomationOutputRecord, generator: ImageGenerator, tier: Tier, preparedPlan?: StoredAiImagePlan): Promise<GeneratedImage> {
  const { POST: createAiImage } = await import("@/app/api/twitter-automation/ai-image/route");
  const response = await createAiImage(createInternalRequest("/api/twitter-automation/ai-image", {
    method: "POST",
    body: JSON.stringify({
      mode: generator,
      language: output.language,
      nativeLanguage: output.native_language,
      tier,
      ...(preparedPlan ? {
        preparedPlan: {
          artDirection: preparedPlan.artDirection,
          caption: preparedPlan.caption,
          ...(preparedPlan.falseFriend ? { falseFriend: preparedPlan.falseFriend } : {}),
        },
      } : {}),
    }),
  }));
  const payload = await readJson(response);
  if (!response.ok || typeof payload?.imageUrl !== "string") throw automationRouteFailure(payload, "image_generation_failed");
  const responsePlan = parseAiImagePlan(payload.plan) ?? preparedPlan;
  if (!responsePlan || (generator === "ai-false-friends" && !responsePlan.falseFriend)) throw new Error("automation_ai_image_plan_missing");
  const generatedCaption = typeof payload.caption === "string" ? payload.caption.trim() : "";
  const caption = generatedCaption || createFoxiesDeckDownloadCaption(output.native_language, output.language);
  return {
    caption,
    mediaPath: await storeGeneratedImage(payload.imageUrl, output.id),
    plan: { ...responsePlan, kind: "ai-image", generator, tier, caption },
  };
}

async function stageGeneratedImage(output: AutomationOutputRecord, generated: GeneratedImage): Promise<AutomationOutputRecord> {
  const staged = {
    ...output,
    status: "queued" as const,
    tier: generated.plan.tier,
    caption: generated.caption,
    media_path: generated.mediaPath,
    media_paths: [],
    media_type: "image" as const,
    render_plan: generated.plan,
    provider_task_id: null,
  };
  await updateOutput(output.id, {
    status: staged.status,
    tier: staged.tier,
    caption: staged.caption,
    media_path: staged.media_path,
    media_paths: staged.media_paths,
    media_type: staged.media_type,
    render_plan: staged.render_plan,
    provider_task_id: staged.provider_task_id,
    generated_at: new Date().toISOString(),
    error_code: null,
  });
  return staged;
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

export async function recordSuccessfulAutomationOutputDuration(output: AutomationOutputRecord) {
  if ((output.status !== "ready_to_schedule" && output.status !== "scheduled") || output.duration_recorded_at || !output.generation_attempt_started_at) return false;
  const startedAt = new Date(output.generation_attempt_started_at).getTime();
  const durationMs = Date.now() - startedAt;
  if (!Number.isFinite(durationMs) || durationMs <= 0) return false;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("record_social_content_automation_mode_duration", {
    p_output_id: output.id,
    p_duration_ms: Math.round(durationMs),
  });
  if (error) throw new Error("automation_duration_record_failed");
  return data === true;
}

function hasNonEmptyCaption(caption: string | null) {
  return Boolean(caption?.trim() && caption.trim().length <= 400);
}

async function validateStoredMedia(path: string, type: "image" | "video") {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).download(path);
  if (error || !data) {
    const statusCode = error && typeof error === "object" && "statusCode" in error ? String(error.statusCode) : "";
    if (statusCode === "404") throw new Error("automation_quality_media_missing");
    throw new Error("automation_quality_storage_unavailable");
  }
  const size = data.size;
  if (!size) throw new Error("automation_quality_media_empty");
  if (type === "image") {
    if (!data.type.startsWith("image/") || size > MAX_STAGED_IMAGE_BYTES) throw new Error("automation_quality_image_invalid");
  } else if (!data.type.startsWith("video/") || size > MAX_STAGED_VIDEO_BYTES) {
    throw new Error("automation_quality_video_invalid");
  }
}

function mediaPathsForOutput(output: AutomationOutputRecord) {
  if (output.content_type === "text" || !output.media_type) return [];
  const directPath = typeof output.media_path === "string" && output.media_path.startsWith(AUTOMATION_MEDIA_PREFIX)
    ? output.media_path
    : null;
  return output.media_type === "image"
    ? (asMediaPaths(output.media_paths).length ? asMediaPaths(output.media_paths) : directPath ? [directPath] : [])
    : directPath ? [directPath] : [];
}

async function validateAutomationOutputMedia(output: AutomationOutputRecord) {
  try {
    if (output.content_type === "text") return { passed: true as const };
    if (!output.media_type) throw new Error("automation_quality_media_missing");
    const paths = mediaPathsForOutput(output);
    if (!paths.length) throw new Error("automation_quality_media_missing");
    await Promise.all(paths.map((path) => validateStoredMedia(path, output.media_type!)));
    return { passed: true as const };
  } catch (error) {
    return { passed: false as const, errorCode: error instanceof Error ? error.message : "automation_quality_media_invalid" };
  }
}

export async function validateAutomationOutputQuality(output: AutomationOutputRecord) {
  try {
    if (!hasNonEmptyCaption(output.description ?? output.caption)) throw new Error("automation_quality_caption_invalid");
    const media = await validateAutomationOutputMedia(output);
    if (!media.passed) throw new Error(media.errorCode);
    await updateOutput(output.id, { quality_status: "passed", quality_error: null, quality_checked_at: new Date().toISOString() });
    return { passed: true as const };
  } catch (error) {
    const errorCode = error instanceof Error ? error.message : "automation_quality_failed";
    logAutomationOutputFailure("output_quality_check_failed", output, error, { qualityError: errorCode });
    await updateOutput(output.id, { quality_status: "failed", quality_error: errorCode, quality_checked_at: new Date().toISOString() });
    return { passed: false as const, errorCode };
  }
}

function automationFailureCode(error: unknown) {
  if (typeof error === "string" && error.trim()) return error;
  const providerCode = getSocialStudioResponsesErrorCode(error);
  if (providerCode) return providerCode;
  return error instanceof Error && error.message.trim()
    ? error.message
    : "automation_processing_failed";
}

function safeAutomationLogText(value: string, maxLength = 1_500) {
  return value
    .replace(/(?:bearer|api[_ -]?key|token)\s+[^\s,;]+/giu, "[credential redacted]")
    .replace(/https?:\/\/[^\s,;]+/giu, "[url omitted]")
    .replace(/(cookie|set-cookie|authorization)\s*[:=]\s*[^\s,;]+/giu, "$1=[credential redacted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function automationErrorLogDetails(error: unknown) {
  const providerDiagnostic = error && typeof error === "object"
    ? (error as AutomationRouteFailure).providerDiagnostic ?? getSocialStudioProviderFailureDetails(error)
    : null;
  let errorMessage: string;
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (error && typeof error === "object") {
    try {
      errorMessage = JSON.stringify(error);
    } catch {
      errorMessage = String(error);
    }
  } else {
    errorMessage = String(error);
  }
  const failureCode = automationFailureCode(error);
  const stack = error instanceof Error && error.stack ? safeAutomationLogText(error.stack, 2_500) : null;
  return {
    code: safeAutomationLogText(failureCode, 320),
    errorClass: classifyAutomationError(failureCode),
    name: error instanceof Error ? error.name : typeof error,
    message: safeAutomationLogText(errorMessage),
    ...(stack ? { stack } : {}),
    ...(providerDiagnostic ? {
      provider: providerDiagnostic.provider,
      providerStatus: providerDiagnostic.status ?? null,
      providerAttemptCount: providerDiagnostic.attemptCount ?? null,
      providerRequestId: providerDiagnostic.requestId ?? null,
      providerDetail: safeAutomationLogText(providerDiagnostic.detail),
    } : {}),
  };
}

export function logAutomationOutputFailure(
  event: string,
  output: AutomationOutputRecord,
  error: unknown,
  details: Record<string, unknown> = {},
) {
  console.error(`[Social Content Automation] ${event}`, {
    output: {
      id: output.id,
      runId: output.run_id,
      dayOffset: output.day_offset ?? null,
      groupName: output.group_name ?? null,
      contentType: output.content_type,
      generator: output.generator,
      language: output.language,
      nativeLanguage: output.native_language,
      tier: output.tier,
      scheduledAt: output.scheduled_at,
      status: output.status,
      attemptCount: output.attempt_count ?? 0,
    },
    failure: automationErrorLogDetails(error),
    ...details,
  });
}

export function logAutomationRequestFailure(event: string, error: unknown, details: Record<string, unknown> = {}) {
  console.error(`[Social Content Automation] ${event}`, {
    failure: automationErrorLogDetails(error),
    ...details,
  });
}

function automationProviderDiagnosticPatch(error: unknown) {
  const routeDiagnostic = error && typeof error === "object"
    ? (error as AutomationRouteFailure).providerDiagnostic
    : null;
  if (routeDiagnostic) {
    return {
      last_error_detail: routeDiagnostic.detail,
      last_provider: routeDiagnostic.provider,
      last_provider_status: routeDiagnostic.status,
      last_provider_attempt_count: routeDiagnostic.attemptCount,
      last_provider_request_id: routeDiagnostic.requestId,
    };
  }
  const diagnostic = getSocialStudioProviderFailureDetails(error);
  return diagnostic
    ? {
      last_error_detail: diagnostic.detail,
      last_provider: diagnostic.provider,
      last_provider_status: diagnostic.status ?? null,
      last_provider_attempt_count: diagnostic.attemptCount ?? null,
      last_provider_request_id: diagnostic.requestId ?? null,
    }
    : {
      last_error_detail: null,
      last_provider: null,
      last_provider_status: null,
      last_provider_attempt_count: null,
      last_provider_request_id: null,
    };
}

export async function queueAutomationOutputRecovery(output: AutomationOutputRecord, error: unknown, fallbackStatus?: OutputStatus) {
  const code = automationFailureCode(error);
  const providerDiagnostic = automationProviderDiagnosticPatch(error);
  const attemptCount = (output.attempt_count ?? 0) + 1;
  const retryable = isRetryableAutomationError(code);
  const exhausted = !retryable || attemptCount >= MAX_AUTOMATION_RECOVERY_ATTEMPTS;
  const errorClass = classifyAutomationError(code);
  const now = new Date().toISOString();
  logAutomationOutputFailure(exhausted ? "output_failed" : "output_recovery_queued", output, error, {
    recovery: {
      retryable,
      exhausted,
      attemptCount,
      maxAttempts: MAX_AUTOMATION_RECOVERY_ATTEMPTS,
      nextStatus: exhausted ? "failed" : fallbackStatus ?? "queued",
      nextAttemptAt: exhausted ? now : nextAutomationAttemptAt(attemptCount),
      errorClass,
    },
  });
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
      generation_attempt_started_at: null,
      ...providerDiagnostic,
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
    generation_attempt_started_at: null,
    ...providerDiagnostic,
  });
  return { queued: true as const, exhausted: false as const, attemptCount };
}

async function makeAutomationOutputReady(output: AutomationOutputRecord, patch: Record<string, unknown> = {}) {
  const patchedCaption = typeof patch.caption === "string" ? patch.caption : output.caption;
  const patchedDescription = typeof patch.description === "string"
    ? patch.description
    : typeof patchedCaption === "string"
      ? patchedCaption
      : output.description ?? null;
  const durableMetadata = {
    title: typeof patch.title === "string" ? patch.title : output.title ?? getSocialDownloadTitle(output.native_language),
    description: patchedDescription,
  };
  const readyOutput = { ...output, ...patch, ...durableMetadata } as AutomationOutputRecord;
  const quality = await validateAutomationOutputQuality(readyOutput);
  if (!quality.passed) {
    await queueAutomationOutputRecovery(readyOutput, quality.errorCode!);
    return false;
  }
  await updateOutput(output.id, {
    ...patch,
    ...durableMetadata,
    status: "ready_to_schedule",
    error_code: null,
    last_error_detail: null,
    last_provider: null,
    last_provider_status: null,
    last_provider_attempt_count: null,
    last_provider_request_id: null,
    next_attempt_at: new Date().toISOString(),
    lease_renderer_id: null,
    lease_expires_at: null,
  });
  try {
    await recordSuccessfulAutomationOutputDuration({ ...readyOutput, status: "ready_to_schedule" });
  } catch (error) {
    // Timing telemetry must never turn an otherwise valid output into a failed generation.
    logAutomationOutputFailure("output_duration_telemetry_failed", readyOutput, error, { nonBlocking: true });
  }
  return true;
}

function isMusicVideoGenerator(generator: string) {
  return (MUSIC_VIDEO_GENERATORS as readonly string[]).includes(generator);
}

async function removeStagedSourceImage(path: string, output: AutomationOutputRecord) {
  if (!path.startsWith(AUTOMATION_MEDIA_PREFIX)) return;
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from(AUTOMATION_BUCKET).remove([path]);
    if (error) logAutomationOutputFailure("server_music_video_source_cleanup_failed", output, error, { path, nonBlocking: true });
  } catch (error) {
    logAutomationOutputFailure("server_music_video_source_cleanup_failed", output, error, { path, nonBlocking: true });
  }
}

/**
 * Complete a music video from a staged image without opening the browser
 * renderer. The image is retained as a durable checkpoint if FFmpeg fails so
 * a retry can resume at the audio/video step instead of regenerating it.
 */
export async function completeServerMusicVideoOutput(output: AutomationOutputRecord) {
  const sourcePath = output.media_path;
  if (!sourcePath || output.media_type !== "image" || !sourcePath.startsWith(AUTOMATION_MEDIA_PREFIX)) {
    throw new Error("server_music_video_source_missing");
  }

  const tier = resolveTier(output.tier);
  const caption = hasNonEmptyCaption(output.caption)
    ? output.caption!
    : createFoxiesDeckDownloadCaption(output.native_language, output.language);

  try {
    const rendered = await renderServerMusicVideo(sourcePath);
    const stored = await storeGeneratedVideoBuffer(rendered.data, output.id);
    const ready = await makeAutomationOutputReady(
      { ...output, tier, caption, media_path: stored.path, media_paths: [], media_type: "video" },
      {
        tier,
        caption,
        media_path: stored.path,
        media_paths: [],
        media_type: "video",
        render_plan: { kind: "server-music-video", caption, generator: output.generator, musicTrack: rendered.musicTrack },
      },
    );
    if (ready) await removeStagedSourceImage(sourcePath, output);
    return { outcome: ready ? "content_ready" as const : "recovery_queued" as const };
  } catch (error) {
    const recovery = await queueAutomationOutputRecovery({ ...output, tier, caption }, error);
    return {
      outcome: recovery.queued ? "recovery_queued" as const : "failed" as const,
      errorCode: automationFailureCode(error),
    };
  }
}

function captionFromRenderPlan(renderPlan: unknown) {
  if (!renderPlan || typeof renderPlan !== "object") return null;
  const caption = (renderPlan as { caption?: unknown }).caption;
  return typeof caption === "string" && caption.trim() ? caption.trim().slice(0, 400) : null;
}

function hasExpectedGeneratedMedia(output: AutomationOutputRecord) {
  if (output.content_type === "image") {
    return output.media_type === "image" && Boolean(output.media_path || asMediaPaths(output.media_paths).length);
  }
  return output.content_type === "video" && output.media_type === "video" && Boolean(output.media_path);
}

function restoreCaptionFromSavedPlan(output: AutomationOutputRecord): AutomationOutputRecord {
  if (hasNonEmptyCaption(output.description ?? output.caption)) {
    return output.caption ? output : { ...output, caption: output.description ?? null };
  }
  if (output.content_type !== "text" && hasExpectedGeneratedMedia(output) && /caption/iu.test(output.error_code ?? "")) {
    return { ...output, caption: createFoxiesDeckDownloadCaption(output.native_language, output.language) };
  }
  const caption = captionFromRenderPlan(output.render_plan);
  if (caption) return { ...output, caption };
  return output.content_type !== "text" && hasExpectedGeneratedMedia(output)
    ? { ...output, caption: createFoxiesDeckDownloadCaption(output.native_language, output.language) }
    : output;
}

async function finalizeStoredOutputIfComplete(output: AutomationOutputRecord) {
  const restored = restoreCaptionFromSavedPlan(output);
  const complete = restored.content_type === "text"
    ? hasNonEmptyCaption(restored.description ?? restored.caption)
    : hasNonEmptyCaption(restored.description ?? restored.caption) && hasExpectedGeneratedMedia(restored);
  if (!complete) return null;

  const patch: Record<string, unknown> = { caption: restored.description ?? restored.caption };
  if (restored.content_type !== "text") {
    patch.media_path = restored.media_path;
    patch.media_paths = restored.media_paths;
    patch.media_type = restored.media_type;
  }
  return await makeAutomationOutputReady(restored, patch);
}

/**
 * Reconcile an output with its durable checkpoint before asking any provider
 * or browser renderer to do work again. In particular, a staged image/video
 * with a missing caption gets the deterministic native-language fallback and
 * is quality-checked instead of being regenerated.
 */
export async function finalizeAutomationOutputCheckpoint(output: AutomationOutputRecord) {
  const finalized = await finalizeStoredOutputIfComplete(output);
  return finalized === true;
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
    status: "processing",
    tier,
    caption: source.caption,
    media_path: source.mediaPath,
    media_paths: [],
    media_type: "image",
    generated_at: new Date().toISOString(),
    error_code: null,
    render_plan: source.plan,
  });
  return (await completeServerMusicVideoOutput({
    ...output,
    generator,
    status: "processing",
    tier,
    caption: source.caption,
    media_path: source.mediaPath,
    media_paths: [],
    media_type: "image",
    render_plan: source.plan,
  })).outcome;
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
  if (!response.ok || typeof payload?.taskId !== "string") throw automationRouteFailure(payload, "video_generation_failed");
  const caption = typeof payload.caption === "string" && payload.caption.trim()
    ? payload.caption.trim()
    : createFoxiesDeckDownloadCaption(output.native_language, output.language);
  const firstFrame = typeof payload.firstFrameUrl === "string" ? await storeGeneratedImage(payload.firstFrameUrl, `${output.id}-preview`) : null;
  await updateOutput(output.id, {
    status: "generating_video",
    tier,
    provider_task_id: payload.taskId,
    caption,
    media_path: firstFrame,
    media_paths: [],
    media_type: "image",
    render_plan: {
      kind: "ai-avatar-video",
      caption,
      spokenLine: typeof payload.spokenLine === "string" ? payload.spokenLine.trim().slice(0, 500) : null,
      card: payload.card ?? null,
    },
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
  if (!response.ok) throw automationRouteFailure(payload, "video_status_failed");
  if (payload?.status === "failed") throw new Error("video_generation_failed");
  if (payload?.status !== "finished" || typeof payload.videoUrl !== "string" || !payload.videoUrl.startsWith("https://")) return { state: "video_pending" as const };
  const video = await storeGeneratedVideo(payload.videoUrl, output.id);
  if (output.media_path?.startsWith(AUTOMATION_MEDIA_PREFIX)) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from(AUTOMATION_BUCKET).remove([output.media_path]);
    if (error) throw new Error("automation_media_cleanup_failed");
  }
  return { state: "video_ready" as const, path: video.path };
}

async function scheduleOutput(output: AutomationOutputRecord): Promise<"scheduled" | "processing"> {
  const jobs = asUploadJobs(output.upload_post_jobs);
  const attemptedAt = new Date().toISOString();
  const attemptCount = (output.schedule_attempt_count ?? 0) + 1;
  let activeSocialMediaId: number | null = null;
  try {
    const accountIds = asAccountIds(output.target_account_ids);
    if (!accountIds.length) throw new Error("automation_target_missing");
    const description = output.description ?? output.caption;
    if (!description) throw new Error("automation_caption_missing");

    const mediaPaths = output.media_type === "image" ? asMediaPaths(output.media_paths) : [];
    const mediaCount = output.media_type === "image"
      ? mediaPaths.length || (output.media_path ? 1 : 0)
      : output.media_type === "video" ? 1 : 0;
    let mediaPromise: Promise<{ asset?: DataUrlAsset | RemoteVideoAsset; assets?: DataUrlAsset[] }> | null = null;
    const loadMedia = () => {
      mediaPromise ??= (async () => {
        if (output.media_type === "image") {
          if (mediaPaths.length) return { assets: await Promise.all(mediaPaths.map(readStoredImage)) };
          if (!output.media_path) throw new Error("automation_media_missing");
          return { asset: await readStoredImage(output.media_path) };
        }
        if (output.media_type === "video") {
          if (!output.media_path) throw new Error("automation_media_missing");
          const sourceUrl = output.media_path.startsWith("https://") ? output.media_path : await createStagedVideoUrl(output.media_path);
          return { asset: { sourceUrl, mimeType: videoMimeType(null, output.media_path) } };
        }
        return {};
      })();
      return mediaPromise;
    };

    const hasUnconfirmedRequest = jobs.some((job) => job.status === "processing" && !job.jobId);
    await updateOutput(output.id, {
      schedule_status: "processing",
      schedule_attempt_count: attemptCount,
      schedule_attempted_at: attemptedAt,
      schedule_error_code: hasUnconfirmedRequest ? UPLOAD_POST_REQUEST_UNCONFIRMED_CODE : null,
      schedule_error_detail: hasUnconfirmedRequest
        ? "The provider request is being verified before retrying to prevent duplicate publication."
        : null,
    });

    for (const socialMediaId of accountIds) {
      activeSocialMediaId = socialMediaId;
      const existingJob = jobs.find((job) => job.socialMediaId === socialMediaId);
      if (existingJob?.jobId) continue;

      const isRetryingRejectedRequest = output.schedule_error_code === "upload_post_rejected";
      const idempotencyKey = isRetryingRejectedRequest
        ? crypto.randomUUID()
        : existingJob?.idempotencyKey ?? `automation-${output.id}-${socialMediaId}`;
      const requestId = isRetryingRejectedRequest
        ? crypto.randomUUID()
        : existingJob?.requestId ?? existingJob?.idempotencyKey ?? idempotencyKey;
      const externalId = existingJob?.externalId ?? `foxiesdeck-automation-${output.id}-${socialMediaId}`;
      const requestStartedAt = new Date().toISOString();
      const requestRecoveryAttemptCount = existingJob?.requestRecoveryAttemptCount ?? (
        existingJob?.requestId && existingJob.requestId !== `automation-${output.id}-${socialMediaId}` ? 1 : 0
      );
      let intent: UploadJob = {
        socialMediaId,
        jobId: null,
        status: "processing",
        requestId,
        idempotencyKey,
        externalId,
        postUrl: existingJob?.postUrl ?? null,
        scheduledAt: output.scheduled_at,
        requestStartedAt: existingJob?.requestStartedAt ?? output.schedule_attempted_at ?? requestStartedAt,
        lastProviderCheckedAt: existingJob ? requestStartedAt : null,
        requestRecoveryAttemptCount,
        manualReviewRequired: existingJob?.manualReviewRequired ?? false,
        attemptedScheduledAt: [...new Set([
          ...(existingJob?.attemptedScheduledAt ?? []),
          ...(existingJob?.scheduledAt ? [existingJob.scheduledAt] : []),
          output.scheduled_at,
        ])].slice(-20),
      };
      const existingIndex = jobs.findIndex((job) => job.socialMediaId === socialMediaId);
      if (existingIndex >= 0) jobs[existingIndex] = intent;
      else jobs.push(intent);

      // Write the provider intent before the external request. On an interrupted
      // response, the next attempt reconciles by external_id and request_id.
      await updateOutput(output.id, {
        upload_post_jobs: jobs,
        schedule_status: "processing",
        schedule_error_code: UPLOAD_POST_REQUEST_UNCONFIRMED_CODE,
        schedule_error_detail: "The provider request is being verified before retrying to prevent duplicate publication.",
        schedule_attempted_at: requestStartedAt,
        schedule_attempt_count: attemptCount,
      });
      const result = await publishWithUploadPost({
        socialMediaId,
        title: output.title ?? getSocialDownloadTitle(output.native_language),
        caption: description,
        nativeLanguage: output.native_language,
        learningLanguage: output.language,
        generator: output.generator,
        renderPlan: output.render_plan,
        applySocialHashtagPolicy: true,
        mediaType: output.media_type,
        mediaCount,
        loadMedia: output.media_type ? loadMedia : undefined,
        scheduledFor: output.scheduled_at,
        requestId,
        idempotencyKey,
        externalId,
        reconcileExistingSchedule: Boolean(existingJob || (output.schedule_attempt_count ?? 0) > 0),
        reconcileRequestIds: [...new Set([requestId, existingJob?.requestId, existingJob?.idempotencyKey].filter((value): value is string => Boolean(value)))],
        attemptedScheduledAt: intent.attemptedScheduledAt,
        requestStartedAt: intent.requestStartedAt,
        requestRecoveryAttemptCount,
        onRequestRotation: async (rotatedRequest) => {
          const currentIndex = jobs.findIndex((job) => job.socialMediaId === socialMediaId);
          const currentJob = jobs[currentIndex] ?? intent;
          const rotatedAt = new Date().toISOString();
          const rotatedJob: UploadJob = {
            ...currentJob,
            jobId: null,
            status: "processing",
            requestId: rotatedRequest.requestId,
            idempotencyKey: rotatedRequest.idempotencyKey,
            requestStartedAt: rotatedAt,
            lastProviderCheckedAt: rotatedAt,
            requestRecoveryAttemptCount: requestRecoveryAttemptCount + 1,
            manualReviewRequired: false,
          };
          // Keep the in-memory intent aligned with the replacement persisted
          // before the POST; the pending/confirmed result below must not write
          // the stale request timestamp or recovery counter back over it.
          intent = rotatedJob;
          if (currentIndex >= 0) jobs[currentIndex] = rotatedJob;
          else jobs.push(rotatedJob);
          await updateOutput(output.id, {
            upload_post_jobs: jobs,
            schedule_status: "processing",
            schedule_error_code: UPLOAD_POST_REQUEST_UNCONFIRMED_CODE,
            schedule_error_detail: "A confirmed failed request is being retried with a new provider request. Its status will be verified before another retry.",
            schedule_attempt_count: attemptCount,
            schedule_attempted_at: new Date().toISOString(),
          });
        },
      });
      if (result.pending) {
        const manualReviewRequired = "manualReviewRequired" in result && result.manualReviewRequired === true;
        const pendingJob: UploadJob = {
          ...intent,
          jobId: null,
          status: "processing",
          requestId: result.requestId ?? requestId,
          idempotencyKey: result.idempotencyKey,
          postUrl: result.postUrl,
          lastProviderCheckedAt: new Date().toISOString(),
          manualReviewRequired,
        };
        jobs[existingIndex >= 0 ? existingIndex : jobs.length - 1] = pendingJob;
        await updateOutput(output.id, {
          upload_post_jobs: jobs,
          schedule_status: "processing",
          schedule_error_code: UPLOAD_POST_REQUEST_UNCONFIRMED_CODE,
          schedule_error_detail: manualReviewRequired
            ? "Upload-Post could not find the fresh request in status, history, or scheduled posts. Automatic resubmission stopped after one fresh request; review the provider account before deciding what to do next."
            : "Upload-Post accepted the request or its response is still propagating. The same request will be checked before any retry.",
          schedule_attempt_count: attemptCount,
          schedule_attempted_at: new Date().toISOString(),
          schedule_completed_at: null,
        });
        continue;
      }
      if (!result.jobId?.trim()) throw new Error("upload_post_job_id_missing");

      const confirmedJob: UploadJob = {
        ...intent,
        jobId: result.jobId,
        status: "scheduled",
        // Persist exactly the key sent in Idempotency-Key. This makes retries
        // safe even if the provider's response request_id is different.
        requestId: result.requestId,
        idempotencyKey: result.idempotencyKey,
        postUrl: result.postUrl,
        lastProviderCheckedAt: new Date().toISOString(),
        manualReviewRequired: false,
      };
      jobs[existingIndex >= 0 ? existingIndex : jobs.length - 1] = confirmedJob;
      await updateOutput(output.id, {
        upload_post_jobs: jobs,
        schedule_attempted_at: attemptedAt,
        schedule_attempt_count: attemptCount,
      });
    }

    const confirmedTargetIds = new Set(jobs.filter((job) => job.jobId).map((job) => job.socialMediaId));
    const unresolvedTargetIds = accountIds.filter((socialMediaId) => !confirmedTargetIds.has(socialMediaId));
    const providerProcessing = jobs.some((job) => job.status === "processing" && !job.jobId && accountIds.includes(job.socialMediaId));
    if (providerProcessing) {
      const manualReviewRequired = jobs.some((job) => job.status === "processing" && !job.jobId && job.manualReviewRequired);
      await updateOutput(output.id, {
        status: "ready_to_schedule",
        schedule_status: "processing",
        schedule_error_code: UPLOAD_POST_REQUEST_UNCONFIRMED_CODE,
        schedule_error_detail: manualReviewRequired
          ? "Upload-Post could not find the fresh request in status, history, or scheduled posts. Automatic resubmission stopped after one fresh request; review the provider account before deciding what to do next."
          : "Upload-Post accepted the request or its response is still propagating. The same request will be checked before any retry.",
        schedule_attempt_count: attemptCount,
        schedule_attempted_at: new Date().toISOString(),
        schedule_completed_at: null,
        upload_post_jobs: jobs,
        error_code: null,
      });
      return "processing";
    }
    if (unresolvedTargetIds.length) throw new Error("upload_post_job_id_missing");

    await updateOutput(output.id, {
      status: "scheduled",
      schedule_status: "scheduled",
      schedule_error_code: null,
      schedule_error_detail: null,
      schedule_attempt_count: attemptCount,
      schedule_attempted_at: attemptedAt,
      schedule_completed_at: new Date().toISOString(),
      upload_post_jobs: jobs,
      scheduled_at_upload_post: new Date().toISOString(),
      error_code: null,
      last_error_detail: null,
      last_provider: null,
      last_provider_status: null,
      last_provider_attempt_count: null,
      last_provider_request_id: null,
    });
    return "scheduled";
  } catch (error) {
    const failureCode = scheduleFailureCode(error);
    const isDefinitiveClientRejection = error instanceof UploadPostRejectedError
      && error.statusCode >= 400
      && error.statusCode < 500
      && error.statusCode !== 408;
    const currentRequestDefinitelyFailed = isDefinitiveClientRejection
      || DEFINITIVE_SCHEDULE_FAILURE_CODES.has(failureCode)
      || failureCode === "upload_post_schedule_async_failed";
    if (activeSocialMediaId !== null && currentRequestDefinitelyFailed) {
      const activeIndex = jobs.findIndex((job) => job.socialMediaId === activeSocialMediaId);
      if (activeIndex >= 0 && !jobs[activeIndex]?.jobId) {
        jobs[activeIndex] = { ...jobs[activeIndex]!, status: "failed" };
      }
    }
    const hasConfirmedJobs = jobs.some((job) => Boolean(job.jobId));
    const hasUnconfirmedRequest = jobs.some((job) => job.status === "processing" && !job.jobId);
    const requestOutcomeUnconfirmed = hasUnconfirmedRequest;
    await updateOutput(output.id, {
      status: "ready_to_schedule",
      schedule_status: requestOutcomeUnconfirmed ? "processing" : hasConfirmedJobs ? "partially_scheduled" : "failed",
      schedule_error_code: requestOutcomeUnconfirmed ? UPLOAD_POST_REQUEST_UNCONFIRMED_CODE : failureCode,
      schedule_error_detail: requestOutcomeUnconfirmed
        ? "The provider response could not be confirmed. Its request id will be checked before another upload is attempted."
        : scheduleFailureDetail(error),
      schedule_attempt_count: attemptCount,
      schedule_attempted_at: attemptedAt,
      schedule_completed_at: null,
      upload_post_jobs: jobs,
      error_code: null,
    });
    if (requestOutcomeUnconfirmed) return "processing";
    throw error;
  }
}

function scheduleFailureCode(error: unknown) {
  if (error instanceof UploadPostRejectedError && error.statusCode === 429) return "upload_post_rate_limited";
  const candidate = error instanceof Error ? error.message : "";
  return /^[a-z][a-z\d_]{2,119}$/u.test(candidate) ? candidate : "automation_schedule_failed";
}

function scheduleFailureDetail(error: unknown) {
  if (error instanceof UploadPostRejectedError) return error.detail;
  const code = scheduleFailureCode(error);
  return getAutomationScheduleFailureReason(code, code);
}

export function describeAutomationScheduleFailure(error: unknown) {
  const errorCode = scheduleFailureCode(error);
  return { errorCode, errorDetail: scheduleFailureDetail(error) };
}

async function loadFutureScheduleReservations(ownerKey: string, omittedOutputIds: ReadonlySet<string>, after: string) {
  const supabase = createSupabaseAdminClient();
  const reservations: AutomationScheduleReservation[] = [];
  const pageSize = 1_000;
  const activeStatuses = ["queued", "processing", "generating_video", "awaiting_browser_image", "awaiting_browser_video", "ready_to_schedule", "scheduled"];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("social_content_automation_outputs")
      .select("id,scheduled_at,target_account_ids,run:social_content_automation_runs!inner(owner_key)")
      .eq("run.owner_key", ownerKey)
      .gte("scheduled_at", after)
      .in("status", activeStatuses)
      .order("scheduled_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("automation_schedule_reservations_failed");

    for (const row of data ?? []) {
      if (omittedOutputIds.has(row.id)) continue;
      for (const accountId of asAccountIds(row.target_account_ids)) {
        reservations.push({ accountId, scheduledAt: row.scheduled_at });
      }
    }
    if (!data || data.length < pageSize) break;
  }

  return reservations;
}

function asMediaPaths(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((path): path is string => typeof path === "string" && path.startsWith(AUTOMATION_MEDIA_PREFIX)))];
}

export async function listAutomationStoragePaths() {
  const supabase = createSupabaseAdminClient();
  const paths = new Set<string>();
  for (let offset = 0; ; offset += STORAGE_PAGE_SIZE) {
    const { data, error } = await supabase.storage.from(AUTOMATION_BUCKET).list("automation", {
      limit: STORAGE_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error("automation_storage_status_failed");
    for (const file of data ?? []) {
      if (file.metadata !== null) paths.add(`${AUTOMATION_MEDIA_PREFIX}${file.name}`);
    }
    if (!data || data.length < STORAGE_PAGE_SIZE) break;
  }
  return paths;
}

/**
 * Re-signing media URLs alone cannot distinguish an expired URL from a missing
 * staged object. Result-screen refreshes use this to verify the underlying
 * Storage object before a ready output can be manually scheduled.
 */
export async function refreshAutomationOutputMediaPreviews(runId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_content_automation_outputs")
    .select("id,run_id,day_offset,group_name,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,media_path,media_paths,media_type,provider_task_id,upload_post_jobs,error_code,attempt_count,next_attempt_at,quality_status,quality_error,lease_renderer_id,lease_expires_at,render_plan,generation_attempt_started_at,duration_recorded_at")
    .eq("run_id", runId)
    .returns<AutomationOutputRecord[]>();
  if (error) throw new Error("automation_media_refresh_query_failed");

  let checked = 0;
  let invalid = 0;
  let unavailable = 0;
  for (const output of data ?? []) {
    // Already-scheduled content may have its staged asset intentionally cleaned
    // up after publishing, so it must never be rewritten as an error here.
    if (output.status !== "ready_to_schedule" || output.content_type === "text") continue;
    checked += 1;
    const media = await validateAutomationOutputMedia(output);
    if (media.passed) continue;
    // A transient Storage outage does not prove that the output is unschedulable.
    // Preserve its ready state and let the next explicit refresh check again.
    if (media.errorCode === "automation_quality_storage_unavailable") {
      unavailable += 1;
      continue;
    }
    invalid += 1;
    logAutomationOutputFailure("output_media_preview_invalid", output, new Error(media.errorCode), {
      mediaError: media.errorCode,
    });
    await updateOutput(output.id, {
      status: "failed",
      error_code: media.errorCode,
      last_error_class: classifyAutomationError(media.errorCode),
      quality_status: "failed",
      quality_error: media.errorCode,
      quality_checked_at: new Date().toISOString(),
      retry_exhausted_at: new Date().toISOString(),
      lease_renderer_id: null,
      lease_expires_at: null,
    });
  }

  await refreshAutomationRunStatus(runId, { autoSchedule: false });
  return unavailable ? { checked, invalid, unavailable } : { checked, invalid };
}

export async function scheduleReadyAutomationRun(runId: string, options: { outputId?: string; outputIds?: string[] }) {
  const outputIds = options.outputIds ? [...new Set(options.outputIds)] : options.outputId ? [options.outputId] : [];
  if (Boolean(options.outputId) === Boolean(options.outputIds?.length)
    || outputIds.length === 0
    || outputIds.length > AUTOMATION_SCHEDULE_BATCH_SIZE
    || (options.outputIds && outputIds.length !== options.outputIds.length)) {
    throw new Error("automation_schedule_batch_invalid");
  }

  const supabase = createSupabaseAdminClient();
  const staleScheduleCutoff = new Date(Date.now() - 15 * 60_000).toISOString();
  const providerRecheckCutoff = new Date(Date.now() - UPLOAD_POST_REQUEST_RECHECK_DELAY_MS).toISOString();
  let providerRecheckQuery = supabase
    .from("social_content_automation_outputs")
    .update({ schedule_attempted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("run_id", runId)
    .eq("status", "ready_to_schedule")
    .eq("schedule_status", "processing")
    .eq("schedule_error_code", UPLOAD_POST_REQUEST_UNCONFIRMED_CODE)
    .lt("schedule_attempted_at", providerRecheckCutoff);
  providerRecheckQuery = providerRecheckQuery.in("id", outputIds);
  const { data: providerRecheckOutputs, error: providerRecheckError } = await providerRecheckQuery
    .select("*")
    .returns<AutomationOutputRecord[]>();
  if (providerRecheckError) throw new Error("automation_schedule_provider_recheck_failed");

  let staleScheduleQuery = supabase
    .from("social_content_automation_outputs")
    .update({ schedule_status: "failed", schedule_error_code: "automation_schedule_attempt_interrupted", schedule_error_detail: "automation_schedule_attempt_interrupted" })
    .eq("run_id", runId)
    .eq("schedule_status", "processing")
    .lt("schedule_attempted_at", staleScheduleCutoff);
  staleScheduleQuery = staleScheduleQuery.in("id", outputIds);
  const { error: staleScheduleError } = await staleScheduleQuery;
  if (staleScheduleError) throw new Error("automation_schedule_recovery_failed");

  const { data: run, error: runError } = await supabase
    .from("social_content_automation_runs")
    .select("owner_key")
    .eq("id", runId)
    .maybeSingle<{ owner_key: string }>();
  if (runError || !run) throw new Error("automation_schedule_run_read_failed");

  let readinessQuery = supabase
    .from("social_content_automation_outputs")
    .select("id,status,quality_status,schedule_status,schedule_error_code,schedule_attempt_count,scheduled_at")
    .eq("run_id", runId);
  readinessQuery = readinessQuery.in("id", outputIds);
  const { data: allOutputs, error: readinessError } = await readinessQuery;
  if (readinessError) throw new Error("automation_schedule_readiness_failed");
  const providerRecheckIds = new Set((providerRecheckOutputs ?? []).map((output) => output.id));
  const alreadyProcessing = (allOutputs ?? []).filter((output) => output.schedule_status === "processing" && !providerRecheckIds.has(output.id)).length;
  const scheduleEligibleStatuses = ["pending", "failed", "partially_scheduled"];
  const eligible = (allOutputs ?? []).filter((output) => output.status === "ready_to_schedule"
    && output.quality_status === "passed"
    && scheduleEligibleStatuses.includes(output.schedule_status)
    && isScheduleErrorEligible(output.schedule_error_code));
  const skipped = (allOutputs ?? []).filter((output) => output.status !== "scheduled"
    && !eligible.some((candidate) => candidate.id === output.id)
    && !providerRecheckIds.has(output.id)).length;

  const { error: runUpdateError } = await supabase.from("social_content_automation_runs")
    .update({ auto_schedule_started_at: new Date().toISOString(), auto_schedule_error: null })
    .eq("id", runId);
  if (runUpdateError) throw new Error("automation_schedule_run_update_failed");

  let lockQuery = supabase
    .from("social_content_automation_outputs")
    .update({ schedule_status: "processing", schedule_attempted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("run_id", runId)
    .eq("status", "ready_to_schedule")
    .eq("quality_status", "passed")
    .in("schedule_status", scheduleEligibleStatuses)
    .or(SCHEDULE_RETRY_ERROR_OR_FILTER);
  lockQuery = lockQuery.in("id", outputIds);
  const { data: lockedOutputs, error: lockError } = await lockQuery
    .select("id,run_id,day_offset,group_name,content_type,generator,language,native_language,tier,scheduled_at,target_account_ids,status,caption,description,title,media_path,media_paths,media_type,provider_task_id,upload_post_jobs,error_code,attempt_count,next_attempt_at,quality_status,quality_error,lease_renderer_id,lease_expires_at,render_plan,schedule_status,schedule_error_code,schedule_attempt_count,schedule_attempted_at")
    .returns<AutomationOutputRecord[]>();
  if (lockError) throw new Error("automation_schedule_lock_failed");
  if (eligible.length && !lockedOutputs?.length) {
    throw new Error("automation_schedule_claim_conflict");
  }

  let scheduled = 0;
  let failed = 0;
  let providerProcessing = 0;
  let nextOutputIndex = 0;
  const lockedOutputList = [...(lockedOutputs ?? []), ...(providerRecheckOutputs ?? [])];
  const pastScheduleOutputs = lockedOutputList.filter((output) => isAutomationScheduleExpired(output.scheduled_at) && !providerRecheckIds.has(output.id));
  for (const output of pastScheduleOutputs) {
    failed += 1;
    await updateOutput(output.id, {
      schedule_status: "failed",
      schedule_error_code: "automation_scheduled_at_in_past",
      schedule_error_detail: "This post's assigned publication time has passed. It was skipped without contacting the publishing provider.",
      schedule_attempt_count: (output.schedule_attempt_count ?? 0) + 1,
      schedule_attempted_at: new Date().toISOString(),
    });
  }
  const outputsToSchedule = lockedOutputList.filter((output) => !pastScheduleOutputs.some((expired) => expired.id === output.id));
  const omittedOutputIds = new Set(outputsToSchedule.map((output) => output.id));
  let reservations: AutomationScheduleReservation[];
  try {
    reservations = await loadFutureScheduleReservations(run.owner_key, omittedOutputIds, new Date(Date.now() - AUTOMATION_SCHEDULE_MIN_LEAD_MS).toISOString());
  } catch (error) {
    // Release ordinary claims. Keep unresolved provider requests locked so an
    // infrastructure failure cannot make the run look finished prematurely.
    for (const output of outputsToSchedule) {
      const providerRecheck = providerRecheckIds.has(output.id);
      await updateOutput(output.id, {
        schedule_status: providerRecheck ? "processing" : "failed",
        schedule_error_code: providerRecheck ? UPLOAD_POST_REQUEST_UNCONFIRMED_CODE : "automation_schedule_reservations_failed",
        schedule_error_detail: providerRecheck
          ? "The existing provider request is still awaiting verification; reservation data was unavailable, so no new upload was sent."
          : "automation_schedule_reservations_failed",
        schedule_attempt_count: (output.schedule_attempt_count ?? 0) + 1,
      }).catch(() => undefined);
    }
    throw error;
  }

  const plannedOutputs: AutomationOutputRecord[] = [];
  for (const output of [...outputsToSchedule].sort((first, second) => new Date(first.scheduled_at).getTime() - new Date(second.scheduled_at).getTime())) {
    try {
      const accountIds = asAccountIds(output.target_account_ids);
      const jobs = asUploadJobs(output.upload_post_jobs);
      const scheduledAccountIds = new Set(jobs.filter((job) => job.jobId).map((job) => job.socialMediaId));
      for (const job of jobs) {
        if (!job.jobId) continue;
        reservations.push({ accountId: job.socialMediaId, scheduledAt: job.scheduledAt ?? output.scheduled_at });
      }
      const pendingAccountIds = accountIds.filter((accountId) => !scheduledAccountIds.has(accountId));
      if (providerRecheckIds.has(output.id)) {
        for (const accountId of pendingAccountIds) reservations.push({ accountId, scheduledAt: output.scheduled_at });
        plannedOutputs.push(output);
        continue;
      }
      const scheduledAt = pendingAccountIds.length
        ? resolveAutomationScheduleAt({ scheduledAt: output.scheduled_at, accountIds: pendingAccountIds, reservations })
        : output.scheduled_at;
      if (scheduledAt !== output.scheduled_at) await updateOutput(output.id, { scheduled_at: scheduledAt });
      plannedOutputs.push({ ...output, scheduled_at: scheduledAt });
      for (const accountId of pendingAccountIds) reservations.push({ accountId, scheduledAt });
    } catch (error) {
      failed += 1;
      const failureCode = scheduleFailureCode(error);
      logAutomationOutputFailure("output_schedule_slot_failed", output, error, { scheduling: true });
      await updateOutput(output.id, {
        status: "ready_to_schedule",
        schedule_status: "failed",
        schedule_error_code: failureCode,
        schedule_error_detail: scheduleFailureDetail(error),
        schedule_attempt_count: (output.schedule_attempt_count ?? 0) + 1,
        schedule_attempted_at: new Date().toISOString(),
      }).catch((updateError) => logAutomationOutputFailure("output_schedule_state_update_failed", output, updateError, { scheduling: true, nonBlocking: true }));
    }
  }

  const worker = async () => {
    while (nextOutputIndex < plannedOutputs.length) {
      const output = plannedOutputs[nextOutputIndex++];
      if (!output) continue;
      try {
        const outcome = await scheduleOutput({ ...output, status: "processing" });
        if (outcome === "processing") providerProcessing += 1;
        else scheduled += 1;
      } catch (error) {
        failed += 1;
        logAutomationOutputFailure("output_schedule_failed", output, error, { scheduling: true });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SCHEDULE_OUTPUT_CONCURRENCY, plannedOutputs.length) }, () => worker()));

  const { data: runOutputs, error: runOutputsError } = await supabase
    .from("social_content_automation_outputs")
    .select("status,schedule_status,schedule_error_code")
    .eq("run_id", runId);
  if (runOutputsError) throw new Error("automation_schedule_run_progress_failed");
  const hasProviderProcessing = (runOutputs ?? []).some((output) => output.status === "ready_to_schedule"
    && output.schedule_status === "processing"
    && output.schedule_error_code === UPLOAD_POST_REQUEST_UNCONFIRMED_CODE);
  const hasRetryableOutputs = (runOutputs ?? []).some((output) => output.status === "ready_to_schedule"
    && output.schedule_status !== "scheduled"
    && isScheduleErrorEligible(output.schedule_error_code));
  const hasScheduleFailures = failed > 0 || (runOutputs ?? []).some((output) => output.status === "ready_to_schedule"
    && (output.schedule_status === "failed" || output.schedule_status === "partially_scheduled"));
  const runScheduleError = hasScheduleFailures
    ? "automation_schedule_partial_failure"
    : hasProviderProcessing
      ? "automation_schedule_provider_processing"
      : null;
  await supabase.from("social_content_automation_runs").update({
    auto_schedule_completed_at: hasRetryableOutputs ? null : new Date().toISOString(),
    auto_schedule_error: runScheduleError,
  }).eq("id", runId);
  await refreshAutomationRunStatus(runId, { autoSchedule: false });
  return { scheduled, failed, processing: providerProcessing + alreadyProcessing, blocked: false, pending: skipped, skipped };
}

export async function processAutomationOutput(output: AutomationOutputRecord) {
  try {
    if (output.status === "generating_video") {
      const finalized = await finalizeStoredOutputIfComplete(output);
      if (finalized !== null) return finalized ? { outcome: "content_ready" as const } : { outcome: "recovery_queued" as const };
      const videoState = await resolveVideo(output);
      if (videoState.state === "video_pending") return { outcome: "video_pending" as const };
      const stagedVideo = { ...output, status: "queued" as const, provider_task_id: null, media_path: videoState.path, media_paths: [], media_type: "video" as const };
      await updateOutput(output.id, {
        status: stagedVideo.status,
        provider_task_id: stagedVideo.provider_task_id,
        media_path: stagedVideo.media_path,
        media_paths: stagedVideo.media_paths,
        media_type: stagedVideo.media_type,
        error_code: null,
      });
      const ready = await makeAutomationOutputReady(stagedVideo, { media_path: videoState.path, media_paths: [], media_type: "video" });
      return ready ? { outcome: "content_ready" as const } : { outcome: "recovery_queued" as const };
    }

    const finalized = await finalizeStoredOutputIfComplete(output);
    if (finalized !== null) return finalized ? { outcome: "content_ready" as const } : { outcome: "recovery_queued" as const };

    const generator = resolveGenerator(output);
    const tier = resolveTier(output.tier);
    if (isMusicVideoGenerator(generator) && output.media_type === "image" && output.media_path) {
      return await completeServerMusicVideoOutput({ ...output, generator, tier });
    }
    if ((TEXT_GENERATORS as readonly string[]).includes(generator)) {
      const caption = await createText(output, generator as TextGenerator);
      const ready = await makeAutomationOutputReady({ ...output, caption }, { caption, generated_at: new Date().toISOString() });
      return ready ? { outcome: "content_ready" as const } : { outcome: "recovery_queued" as const };
    }
    if ((IMAGE_GENERATORS as readonly string[]).includes(generator)) {
      const imageGenerator = generator as ImageGenerator;
      const generated = await createImage(output, imageGenerator, tier, getStoredAiImagePlan(output, imageGenerator) ?? undefined);
      const stagedImage = await stageGeneratedImage(output, generated);
      const ready = await makeAutomationOutputReady(stagedImage, { caption: generated.caption, media_path: generated.mediaPath, media_paths: [], media_type: "image", generated_at: new Date().toISOString() });
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
    const code = automationFailureCode(error);
    const recovery = await queueAutomationOutputRecovery(output, error);
    return recovery.queued ? { outcome: "recovery_queued" as const, errorCode: code } : { outcome: "failed" as const, errorCode: code };
  }
}

export async function refreshAutomationRunStatus(runId: string, _options: { autoSchedule?: boolean } = {}) {
  void _options;
  const supabase = createSupabaseAdminClient();
  const [{ data, error }, { data: run, error: runError }] = await Promise.all([
    supabase.from("social_content_automation_outputs").select("status").eq("run_id", runId),
    supabase.from("social_content_automation_runs").select("finished_by_user_at").eq("id", runId).maybeSingle<{ finished_by_user_at: string | null }>(),
  ]);
  if (error) throw new Error("automation_run_status_failed");
  if (runError) throw new Error("automation_run_status_failed");
  if (!run || run.finished_by_user_at) return;
  const statuses = (data ?? []).map((item) => item.status as OutputStatus);
  if (statuses.some((status) => status === "queued" || status === "processing" || status === "generating_video" || status === "awaiting_browser_image" || status === "awaiting_browser_video")) {
    await supabase.from("social_content_automation_runs").update({ status: "processing" }).eq("id", runId).is("finished_by_user_at", null);
    return;
  }
  if (statuses.some((status) => status === "ready_to_schedule")) {
    await supabase.from("social_content_automation_runs").update({ status: "ready_to_schedule", completed_at: null }).eq("id", runId).is("finished_by_user_at", null);
    // Scheduling is run by the browser in explicit batches so we can enforce
    // a 90-second cooldown without holding a Vercel request open.
    return;
  }
  // Generation reaching a reviewable state is not the same as the user
  // finishing the run. Keep the run open until the explicit Generated Posts
  // action records finished_by_user_at.
  await supabase.from("social_content_automation_runs").update({
    status: "ready_to_schedule",
    completed_at: null,
  }).eq("id", runId).is("finished_by_user_at", null);
}
