import "server-only";

import { SOCIAL_STUDIO_SESSION_COOKIE, createSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { publishWithUploadPost, type DataUrlAsset, type RemoteVideoAsset } from "@/features/twitter-automation/upload-post-publishing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LanguageCode, Tier } from "@/types/domain";

const AUTOMATION_BUCKET = "social-studio-automation";
const AUTOMATION_MEDIA_PREFIX = "automation/";
const STAGED_MEDIA_URL_SECONDS = 24 * 60 * 60;
const STAGED_MEDIA_RETENTION_MS = 48 * 60 * 60 * 1000;
const MAX_STAGED_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_STAGED_VIDEO_BYTES = 100 * 1024 * 1024;
const IMAGE_GENERATORS = ["ai-word-of-the-day", "ai-mini-quiz", "ai-false-friends", "ai-daily-challenge", "ai-vocabulary-progression"] as const;
const TEXT_GENERATORS = ["fun-post", "word-quiz", "language-tip", "false-friends", "daily-challenge", "relatable-learner"] as const;
const VIDEO_GENERATORS = ["ai-word-of-the-day-video"] as const;
const TIER_OPTIONS: Tier[] = ["A1", "A2", "B1", "B2", "C1"];

type ImageGenerator = (typeof IMAGE_GENERATORS)[number];
type TextGenerator = (typeof TEXT_GENERATORS)[number];
type OutputStatus = "queued" | "processing" | "generating_video" | "scheduled" | "failed";

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
  media_type: "image" | "video" | null;
  provider_task_id: string | null;
  upload_post_jobs: unknown;
};

type UploadJob = { socialMediaId: number; jobId: string | null; requestId: string | null; postUrl: string | null };

function pick<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)]!;
}

function resolveTier(tier: Tier | "random") {
  return tier === "random" ? pick(TIER_OPTIONS) : tier;
}

function resolveGenerator(output: AutomationOutputRecord) {
  if (output.generator === "random-content") return pick([...TEXT_GENERATORS, ...IMAGE_GENERATORS, ...VIDEO_GENERATORS]);
  if (output.generator === "random-text") return pick(TEXT_GENERATORS);
  if (output.generator === "random-image" || output.generator === "random-ai-image" || output.generator === "random-no-ai-image" || output.generator === "word-of-the-day" || output.generator === "word-of-the-day-poster") return pick(IMAGE_GENERATORS);
  if (output.generator === "random-video") return pick(VIDEO_GENERATORS);
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

async function storeGeneratedImage(dataUrl: string, outputId: string) {
  const image = parseDataUrl(dataUrl);
  if (!image.data.length || image.data.length > MAX_STAGED_IMAGE_BYTES) throw new Error("generated_image_too_large");
  const extension = image.mimeType === "image/png" ? "png" : image.mimeType === "image/jpeg" ? "jpg" : "webp";
  const path = `${AUTOMATION_MEDIA_PREFIX}${outputId}.${extension}`;
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
  if (payload?.status !== "finished" || typeof payload.videoUrl !== "string" || !payload.videoUrl.startsWith("https://")) return "video_pending";
  const video = await storeGeneratedVideo(payload.videoUrl, output.id);
  if (output.media_path?.startsWith(AUTOMATION_MEDIA_PREFIX)) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from(AUTOMATION_BUCKET).remove([output.media_path]);
    if (error) throw new Error("automation_media_cleanup_failed");
  }
  await updateOutput(output.id, { media_path: video.path, media_type: "video", error_code: null });
  return "video_ready";
}

async function scheduleOutput(output: AutomationOutputRecord) {
  const accountIds = asAccountIds(output.target_account_ids);
  if (!accountIds.length) throw new Error("automation_target_missing");
  if (!output.caption) throw new Error("automation_caption_missing");

  let asset: DataUrlAsset | RemoteVideoAsset | undefined;
  if (output.media_type === "image") {
    if (!output.media_path) throw new Error("automation_media_missing");
    asset = await readStoredImage(output.media_path);
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

export async function processAutomationOutput(output: AutomationOutputRecord) {
  try {
    if (output.status === "generating_video") {
      const videoState = await resolveVideo(output);
      if (videoState === "video_pending") return { outcome: "video_pending" as const };
      const refreshed = { ...output, media_path: (await createSupabaseAdminClient().from("social_content_automation_outputs").select("media_path, media_type").eq("id", output.id).single()).data?.media_path ?? output.media_path, media_type: "video" as const };
      return { outcome: await scheduleOutput(refreshed) };
    }

    const generator = resolveGenerator(output);
    const tier = resolveTier(output.tier);
    if ((TEXT_GENERATORS as readonly string[]).includes(generator)) {
      const caption = await createText(output, generator as TextGenerator);
      const readyOutput = { ...output, caption };
      await updateOutput(output.id, { caption, generated_at: new Date().toISOString(), error_code: null });
      return { outcome: await scheduleOutput(readyOutput) };
    }
    if ((IMAGE_GENERATORS as readonly string[]).includes(generator)) {
      const generated = await createImage(output, generator as ImageGenerator, tier);
      const readyOutput = { ...output, caption: generated.caption, media_path: generated.mediaPath, media_type: "image" as const };
      await updateOutput(output.id, { caption: generated.caption, media_path: generated.mediaPath, media_type: "image", generated_at: new Date().toISOString(), error_code: null });
      return { outcome: await scheduleOutput(readyOutput) };
    }
    if (generator === "ai-word-of-the-day-video") return { outcome: await startVideo(output, tier) };
    throw new Error("unsupported_automation_generator");
  } catch (error) {
    const code = error instanceof Error ? error.message : "automation_processing_failed";
    await updateOutput(output.id, { status: "failed", error_code: code });
    return { outcome: "failed" as const, errorCode: code };
  }
}

export async function refreshAutomationRunStatus(runId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("social_content_automation_outputs").select("status").eq("run_id", runId);
  if (error) throw new Error("automation_run_status_failed");
  const statuses = (data ?? []).map((item) => item.status as OutputStatus);
  if (statuses.some((status) => status === "queued" || status === "processing" || status === "generating_video")) {
    await supabase.from("social_content_automation_runs").update({ status: "processing" }).eq("id", runId);
    return;
  }
  await supabase.from("social_content_automation_runs").update({
    status: statuses.some((status) => status === "failed") ? "completed_with_errors" : "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
}

export async function cleanupStagedAutomationMedia(now = new Date()) {
  const cutoff = new Date(now.getTime() - STAGED_MEDIA_RETENTION_MS).toISOString();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_content_automation_outputs")
    .select("id,media_path")
    .eq("status", "scheduled")
    .not("media_path", "is", null)
    .lt("scheduled_at_upload_post", cutoff)
    .limit(100);
  if (error) throw new Error("automation_media_cleanup_query_failed");

  const staleOutputs = (data ?? []).filter((output) => typeof output.media_path === "string" && output.media_path.startsWith(AUTOMATION_MEDIA_PREFIX));
  if (!staleOutputs.length) return { removed: 0 };

  const paths = staleOutputs.map((output) => output.media_path as string);
  const { error: removeError } = await supabase.storage.from(AUTOMATION_BUCKET).remove(paths);
  if (removeError) throw new Error("automation_media_cleanup_failed");

  const { error: updateError } = await supabase
    .from("social_content_automation_outputs")
    .update({ media_path: null, media_type: null, updated_at: now.toISOString() })
    .in("id", staleOutputs.map((output) => output.id));
  if (updateError) throw new Error("automation_media_cleanup_update_failed");
  return { removed: staleOutputs.length };
}
