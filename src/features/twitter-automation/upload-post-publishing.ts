import "server-only";

import crypto from "node:crypto";
import { isLanguageCode } from "@/data/languages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createTitleOnlySocialTitle, getSocialDownloadTitle } from "@/features/twitter-automation/social-video-titles";
import { adaptSocialCaptionHashtags, getSocialPostHashtags, usesDorficVisualStyle } from "@/features/twitter-automation/social-platform-hashtags";
import { normalizeUploadPostPlatform, UPLOAD_POST_CONTENT_PLATFORMS } from "@/features/twitter-automation/upload-post-capabilities";
import { getUploadPostScheduleFields } from "@/features/twitter-automation/upload-post-schedule-fields";
import { findAcceptedUploadPostSchedule, getUploadPostRequestStatus } from "@/features/twitter-automation/upload-post-schedule-recovery";
import { UploadPostRejectedError } from "@/features/twitter-automation/upload-post-provider-error";

const UPLOAD_POST_BASE_URL = "https://api.upload-post.com/api";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const TITLE_ONLY_PLATFORMS = new Set([
  "tiktok", "instagram", "linkedin", "facebook", "x", "threads", "bluesky", "discord", "telegram",
  "google_business", "mastodon", "lemmy", "wordpress",
]);

type SocialMediaRow = {
  id: number;
  "Social Media": string | null;
  "Account Name": string | null;
  "upload-post profile username": string | null;
};

type DataUrlAsset = {
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

type RemoteVideoAsset = {
  sourceUrl: string;
  mimeType: "video/mp4" | "video/webm";
};

export type UploadPostPublishOptions = {
  instagramMediaType?: "REELS" | "STORIES";
  instagramShareToFeed?: boolean;
  tiktokPrivacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
  youtubePrivacyStatus?: "public" | "unlisted" | "private";
  youtubeCategoryId?: string;
  facebookPageId?: string;
  facebookMediaType?: "REELS" | "STORIES" | "VIDEO";
  linkedinVisibility?: "PUBLIC" | "CONNECTIONS" | "LOGGED_IN" | "CONTAINER";
  threadsTopicTag?: string;
  threadsReplyControl?: "everyone" | "accounts_you_follow" | "mentioned_only";
  threadsAltText?: string;
  xReplySettings?: "everyone" | "mentionedUsers" | "following";
  pinterestBoardId?: string;
  pinterestLink?: string;
  pinterestAltText?: string;
  blueskyAltText?: string;
  blueskyThreadgate?: "following" | "mention" | "list" | "mutuals";
  gbpLocationId?: string;
  gbpTopicType?: "STANDARD" | "EVENT" | "OFFER";
  gbpCtaType?: "BOOK" | "ORDER" | "SHOP" | "LEARN_MORE" | "SIGN_UP" | "CALL";
  gbpCtaUrl?: string;
};

export type UploadPostMediaBundle = {
  asset?: DataUrlAsset | RemoteVideoAsset;
  assets?: DataUrlAsset[];
};

type UploadPostResponse = {
  success?: boolean;
  request_id?: string;
  job_id?: string;
  message?: string;
  results?: Record<string, { url?: string; success?: boolean; error?: string }>;
};

export type UploadPostScheduledPost = {
  jobId: string;
  scheduledDate: string | null;
  postType: string | null;
  profileUsername: string | null;
  title: string | null;
  caption: string | null;
  previewUrl: string | null;
  platforms: string[];
  status: string | null;
};

function getRequiredEnvironmentValue(name: "UPLOAD_POST_API_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error("upload_post_not_configured");
  return value;
}

export function isUploadPostConfigured() {
  return Boolean(process.env.UPLOAD_POST_API_KEY?.trim());
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asTextList(value: unknown) {
  if (Array.isArray(value)) return value.flatMap((item) => asText(item) ? [asText(item)!] : []);
  const item = asText(value);
  return item ? [item] : [];
}

function getScheduledPostItems(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];
  if (Array.isArray(record.scheduled_posts)) return record.scheduled_posts;
  if (Array.isArray(record.jobs)) return record.jobs;
  if (Array.isArray(record.posts)) return record.posts;

  const data = asRecord(record.data);
  if (!data) return [];
  if (Array.isArray(data.scheduled_posts)) return data.scheduled_posts;
  if (Array.isArray(data.jobs)) return data.jobs;
  return Array.isArray(data.posts) ? data.posts : [];
}

function readRemoteUrl(value: unknown) {
  const direct = asText(value);
  if (direct?.startsWith("https://")) return direct;
  const record = asRecord(value);
  if (!record) return null;
  return [record.url, record.signed_url, record.href, record.preview_url]
    .map((candidate) => asText(candidate))
    .find((candidate) => candidate?.startsWith("https://")) ?? null;
}

function toScheduledPost(value: unknown): UploadPostScheduledPost | null {
  const record = asRecord(value);
  const jobId = asText(record?.job_id);
  if (!record || !jobId) return null;

  const previewUrl = readRemoteUrl(record.preview_url)
    ?? readRemoteUrl(record.thumbnail_url)
    ?? readRemoteUrl(record.cover_preview_url);
  return {
    jobId,
    scheduledDate: asText(record.scheduled_date) ?? asText(record.scheduled_for),
    postType: asText(record.post_type) ?? asText(record.type),
    profileUsername: asText(record.profile_username),
    title: asText(record.title),
    caption: asText(record.caption) ?? asText(record.description),
    previewUrl,
    platforms: asTextList(record.platforms ?? record.platform),
    status: asText(record.status) ?? asText(record.state),
  };
}

export async function listUploadPostScheduledPosts() {
  const apiKey = getRequiredEnvironmentValue("UPLOAD_POST_API_KEY");
  const response = await fetch(`${UPLOAD_POST_BASE_URL}/uploadposts/schedule`, {
    headers: { Authorization: `Apikey ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) throw new Error("upload_post_scheduled_posts_unavailable");

  return getScheduledPostItems(payload)
    .flatMap((item) => {
      const post = toScheduledPost(item);
      return post ? [post] : [];
    })
    .sort((first, second) => (first.scheduledDate ?? "").localeCompare(second.scheduledDate ?? ""));
}

export async function cancelUploadPostScheduledPost(jobId: string) {
  const apiKey = getRequiredEnvironmentValue("UPLOAD_POST_API_KEY");
  const response = await fetch(`${UPLOAD_POST_BASE_URL}/uploadposts/schedule/${encodeURIComponent(jobId)}`, {
    method: "DELETE",
    headers: { Authorization: `Apikey ${apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error("upload_post_scheduled_post_cancel_failed");
}

function parseImageDataUrl(asset: DataUrlAsset) {
  const match = asset.dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/u);
  if (!match || match[1] !== asset.mimeType) throw new Error("invalid_media");

  const image = Buffer.from(match[2], "base64");
  if (!image.length || image.length > MAX_IMAGE_BYTES) throw new Error("invalid_media");
  return image;
}

function isRemoteVideoAsset(asset: DataUrlAsset | RemoteVideoAsset): asset is RemoteVideoAsset {
  return "sourceUrl" in asset;
}

function getExtension(mimeType: DataUrlAsset["mimeType"]) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  return "webp";
}

function appendOptional(form: FormData, key: string, value: string | undefined) {
  const normalized = value?.trim();
  if (normalized) form.append(key, normalized);
}

function appendPlatformSettings(form: FormData, platform: string, title: string | undefined, options?: UploadPostPublishOptions) {
  if (title?.trim()) form.append(`${platform}_title`, title.trim());

  if (platform === "instagram") {
    appendOptional(form, "media_type", options?.instagramMediaType);
    if (options?.instagramShareToFeed !== undefined) form.append("share_to_feed", String(options.instagramShareToFeed));
  }

  if (platform === "tiktok") appendOptional(form, "privacy_level", options?.tiktokPrivacyLevel);

  if (platform === "youtube") {
    appendOptional(form, "privacyStatus", options?.youtubePrivacyStatus);
    appendOptional(form, "categoryId", options?.youtubeCategoryId);
  }

  if (platform === "pinterest") {
    const boardId = options?.pinterestBoardId?.trim() || process.env.UPLOAD_POST_PINTEREST_BOARD_ID?.trim();
    if (!boardId) throw new Error("upload_post_pinterest_board_not_configured");
    form.append("pinterest_board_id", boardId);
    appendOptional(form, "pinterest_link", options?.pinterestLink);
    appendOptional(form, "pinterest_alt_text", options?.pinterestAltText);
  }

  if (platform === "facebook") {
    const pageId = options?.facebookPageId?.trim() || process.env.UPLOAD_POST_FACEBOOK_PAGE_ID?.trim();
    appendOptional(form, "facebook_page_id", pageId);
    appendOptional(form, "facebook_media_type", options?.facebookMediaType);
  }

  if (platform === "linkedin") appendOptional(form, "visibility", options?.linkedinVisibility);

  if (platform === "threads") {
    appendOptional(form, "threads_topic_tag", options?.threadsTopicTag);
    appendOptional(form, "threads_reply_control", options?.threadsReplyControl);
    appendOptional(form, "threads_alt_text", options?.threadsAltText);
  }

  if (platform === "x") appendOptional(form, "reply_settings", options?.xReplySettings);

  if (platform === "bluesky") {
    appendOptional(form, "bluesky_alt_text", options?.blueskyAltText);
    appendOptional(form, "bluesky_threadgate", options?.blueskyThreadgate);
  }

  if (platform === "google_business") {
    appendOptional(form, "gbp_location_id", options?.gbpLocationId);
    appendOptional(form, "gbp_topic_type", options?.gbpTopicType);
    appendOptional(form, "gbp_cta_type", options?.gbpCtaType);
    appendOptional(form, "gbp_cta_url", options?.gbpCtaUrl);
  }
}

async function getTarget(socialMediaId: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_medias")
    .select('id,"Social Media","Account Name","upload-post profile username"')
    .eq("id", socialMediaId)
    .maybeSingle<SocialMediaRow>();
  if (error || !data || !data["Social Media"]?.trim() || !data["Account Name"]?.trim() || data["Social Media"].trim().toLocaleLowerCase() === "email") {
    throw new Error("account_not_found");
  }

  const profileUsername = data["upload-post profile username"]?.trim();
  if (!profileUsername) throw new Error("upload_post_profile_not_configured");

  return { platform: normalizeUploadPostPlatform(data["Social Media"]), accountName: data["Account Name"].trim(), profileUsername };
}

async function submitUpload(endpoint: string, form: FormData, idempotencyKey: string, platform: string) {
  const apiKey = getRequiredEnvironmentValue("UPLOAD_POST_API_KEY");
  const response = await fetch(`${UPLOAD_POST_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Apikey ${apiKey}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json().catch(() => null) as UploadPostResponse | null;
  const providerResult = payload?.results?.[platform];
  if (!response.ok || !payload?.success || providerResult?.success === false || providerResult?.error) {
    const rejection = new UploadPostRejectedError(response.status, providerResult?.error ?? payload?.message, response.headers);
    console.error("[upload-post] publish rejected", {
      endpoint,
      platform,
      requestId: form.get("request_id"),
      status: response.status,
      providerError: rejection.detail,
    });
    throw rejection;
  }

  const firstResult = Object.values(payload.results ?? {}).find((result) => typeof result?.url === "string");
  return {
    requestId: payload.request_id ?? null,
    jobId: payload.job_id ?? null,
    postUrl: firstResult?.url ?? null,
  };
}

export async function publishWithUploadPost({ socialMediaId, caption, title, nativeLanguage, learningLanguage, generator, renderPlan, applySocialHashtagPolicy = false, asset, assets, mediaType, mediaCount, loadMedia, scheduledFor, requestId, idempotencyKey, externalId, reconcileExistingSchedule, reconcileRequestIds, attemptedScheduledAt, onRequestRotation, options }: {
  socialMediaId: number;
  caption: string;
  title?: string;
  nativeLanguage?: string;
  learningLanguage?: string;
  generator?: string;
  renderPlan?: unknown;
  applySocialHashtagPolicy?: boolean;
  asset?: DataUrlAsset | RemoteVideoAsset;
  assets?: DataUrlAsset[];
  mediaType?: "image" | "video" | null;
  mediaCount?: number;
  loadMedia?: () => Promise<UploadPostMediaBundle>;
  scheduledFor?: string;
  requestId?: string;
  idempotencyKey?: string;
  externalId?: string;
  reconcileExistingSchedule?: boolean;
  reconcileRequestIds?: readonly string[];
  attemptedScheduledAt?: readonly string[];
  onRequestRotation?: (request: { requestId: string; idempotencyKey: string }) => Promise<void>;
  options?: UploadPostPublishOptions;
}) {
  const target = await getTarget(socialMediaId);
  if (target.platform === "reddit") throw new Error("upload_post_reddit_unavailable");
  const actualMediaCount = mediaCount ?? assets?.length ?? (asset ? 1 : 0);
  if (target.platform === "pinterest" && actualMediaCount > 5) throw new Error("upload_post_carousel_limit");
  const declaredMediaType = mediaType ?? (assets?.length ? "image" : asset ? isRemoteVideoAsset(asset) ? "video" : "image" : null);
  const supportedPlatforms = declaredMediaType === "video"
    ? UPLOAD_POST_CONTENT_PLATFORMS.video
    : declaredMediaType === "image"
      ? UPLOAD_POST_CONTENT_PLATFORMS.image
      : UPLOAD_POST_CONTENT_PLATFORMS.text;
  if (!supportedPlatforms.has(target.platform)) throw new Error("upload_post_unsupported_content");

  const hasMedia = Boolean(declaredMediaType || asset || assets?.length);
  const requestedNativeLanguage = nativeLanguage ?? "";
  const requestedLearningLanguage = learningLanguage ?? "";
  const resolvedNativeLanguage = isLanguageCode(requestedNativeLanguage) ? requestedNativeLanguage : "en";
  const resolvedLearningLanguage = isLanguageCode(requestedLearningLanguage) ? requestedLearningLanguage : resolvedNativeLanguage;
  const isDorficVisual = usesDorficVisualStyle(generator, renderPlan);
  const socialHashtags = applySocialHashtagPolicy
    ? getSocialPostHashtags({
      platform: target.platform,
      learningLanguage: resolvedLearningLanguage,
      nativeLanguage: resolvedNativeLanguage,
      dorficVisual: isDorficVisual,
    })
    : undefined;
  const socialCaption = applySocialHashtagPolicy
    ? adaptSocialCaptionHashtags({
      caption,
      platform: target.platform,
      learningLanguage: resolvedLearningLanguage,
      nativeLanguage: resolvedNativeLanguage,
      dorficVisual: isDorficVisual,
    })
    : caption;
  const explicitTitle = title?.trim();
  const defaultTitle = hasMedia ? getSocialDownloadTitle(resolvedNativeLanguage) : socialCaption;
  const providerTitle = explicitTitle || (
    hasMedia && TITLE_ONLY_PLATFORMS.has(target.platform)
      ? createTitleOnlySocialTitle(caption, resolvedNativeLanguage, resolvedLearningLanguage, 100, socialHashtags)
      : defaultTitle
  );
  let uploadRequestId = requestId ?? crypto.randomUUID();
  let uploadIdempotencyKey = idempotencyKey ?? uploadRequestId;
  const apiKey = getRequiredEnvironmentValue("UPLOAD_POST_API_KEY");

  const resolveRequestStatus = async (ids: readonly string[]) => {
    const statuses: Array<Awaited<ReturnType<typeof getUploadPostRequestStatus>>> = [];
    for (const id of [...new Set(ids.map((value) => value.trim()).filter(Boolean))]) {
      const status = await getUploadPostRequestStatus({ apiKey, requestId: id });
      if (status.jobId) return { kind: "scheduled" as const, jobId: status.jobId, requestId: status.requestId };
      statuses.push(status);
    }
    const pendingRequest = statuses.find(({ status, platformStatuses }) => status === "pending" || status === "queued" || status === "processing" || status === "in_progress"
      || platformStatuses.some((platformStatus) => platformStatus === "queued" || platformStatus === "processing" || platformStatus === "retryable"));
    if (pendingRequest) {
      return { kind: "processing" as const, requestId: pendingRequest.requestId };
    }
    if (statuses.some(({ status }) => status === "completed")) return { kind: "completed" as const };
    if (statuses.some(({ status }) => status === "failed")) {
      return { kind: "failed" as const };
    }
    return { kind: "not_found" as const };
  };

  const submit = async (endpoint: string, form: FormData) => {
    const result = await submitUpload(endpoint, form, uploadIdempotencyKey, target.platform);
    if (!scheduledFor || result.jobId) return { ...result, idempotencyKey: uploadIdempotencyKey, pending: false };

    const status = await resolveRequestStatus([result.requestId ?? uploadRequestId]);
    if (status.kind === "scheduled") {
      return { ...result, requestId: status.requestId, jobId: status.jobId, idempotencyKey: uploadIdempotencyKey, pending: false };
    }
    if (status.kind === "completed") {
      const recoveredJobId = externalId
        ? await findAcceptedUploadPostSchedule({
          apiKey,
          profileUsername: target.profileUsername,
          externalId,
          requestIds: [result.requestId ?? uploadRequestId],
          attemptedScheduledAt: attemptedScheduledAt?.length ? attemptedScheduledAt : [scheduledFor],
        })
        : null;
      if (recoveredJobId) return { ...result, jobId: recoveredJobId, idempotencyKey: uploadIdempotencyKey, pending: false };
      throw new Error("upload_post_schedule_reconciliation_incomplete");
    }
    if (status.kind === "failed") throw new Error("upload_post_schedule_async_failed");

    // The provider accepted the HTTP request but has not exposed a schedulable
    // job yet. Keep its request id so a later attempt checks status instead of
    // uploading the same media again.
    return {
      ...result,
      requestId: result.requestId ?? uploadRequestId,
      idempotencyKey: uploadIdempotencyKey,
      pending: true,
    };
  };

  if (scheduledFor && externalId && reconcileExistingSchedule) {
    const recoveredJobId = await findAcceptedUploadPostSchedule({
      apiKey,
      profileUsername: target.profileUsername,
      externalId,
      requestIds: reconcileRequestIds?.length ? reconcileRequestIds : [uploadRequestId],
      attemptedScheduledAt: attemptedScheduledAt?.length ? attemptedScheduledAt : [scheduledFor],
    });
    if (recoveredJobId) return { requestId: uploadRequestId, jobId: recoveredJobId, postUrl: null, idempotencyKey: uploadIdempotencyKey, pending: false };

    const status = await resolveRequestStatus(reconcileRequestIds?.length ? reconcileRequestIds : [uploadRequestId]);
    if (status.kind === "scheduled") {
      return { requestId: status.requestId, jobId: status.jobId, postUrl: null, idempotencyKey: uploadIdempotencyKey, pending: false };
    }
    if (status.kind === "processing") {
      return { requestId: status.requestId, jobId: null, postUrl: null, idempotencyKey: uploadIdempotencyKey, pending: true };
    }
    if (status.kind === "completed") {
      const completedJobId = await findAcceptedUploadPostSchedule({
        apiKey,
        profileUsername: target.profileUsername,
        externalId,
        requestIds: reconcileRequestIds?.length ? reconcileRequestIds : [uploadRequestId],
        attemptedScheduledAt: attemptedScheduledAt?.length ? attemptedScheduledAt : [scheduledFor],
      });
      if (completedJobId) return { requestId: uploadRequestId, jobId: completedJobId, postUrl: null, idempotencyKey: uploadIdempotencyKey, pending: false };
      throw new Error("upload_post_schedule_reconciliation_incomplete");
    }
    if (status.kind === "failed") {
      // A confirmed terminal failure is safe to retry with a fresh idempotency
      // key. Reusing the old key could replay the provider's cached failure.
      uploadRequestId = crypto.randomUUID();
      uploadIdempotencyKey = crypto.randomUUID();
      // Persist the replacement before contacting the provider. If the POST
      // times out, the next attempt must reconcile this exact idempotency key.
      await onRequestRotation?.({ requestId: uploadRequestId, idempotencyKey: uploadIdempotencyKey });
    }
  }

  const form = new FormData();
  form.append("user", target.profileUsername);
  form.append("platform[]", target.platform);
  form.append("title", providerTitle);
  form.append("description", socialCaption);
  form.append("request_id", uploadRequestId);
  if (externalId) form.append("external_id", externalId);
  for (const [name, value] of getUploadPostScheduleFields(scheduledFor)) form.append(name, value);
  if (scheduledFor) form.append("async_upload", "true");
  appendPlatformSettings(form, target.platform, providerTitle, options);

  const loadedMedia = loadMedia ? await loadMedia() : null;
  const publishAssets = loadedMedia?.assets ?? assets;
  const publishAsset = loadedMedia?.asset ?? asset;
  if (declaredMediaType && !publishAsset && !publishAssets?.length) throw new Error("automation_media_missing");

  if (publishAssets?.length) {
    publishAssets.forEach((carouselAsset, index) => {
      const image = parseImageDataUrl(carouselAsset);
      form.append("photos[]", new Blob([image], { type: carouselAsset.mimeType }), `foxiesdeck-carousel-${index + 1}.${getExtension(carouselAsset.mimeType)}`);
    });
    return submit("/upload_photos", form);
  }

  if (!publishAsset) return submit("/upload_text", form);

  if (isRemoteVideoAsset(publishAsset)) {
    const source = new URL(publishAsset.sourceUrl);
    if (source.protocol !== "https:") throw new Error("invalid_media");
    form.append("video", source.toString());
    return submit("/upload", form);
  }

  const image = parseImageDataUrl(publishAsset);
  form.append("photos[]", new Blob([image], { type: publishAsset.mimeType }), `foxiesdeck.${getExtension(publishAsset.mimeType)}`);
  return submit("/upload_photos", form);
}

export type { DataUrlAsset, RemoteVideoAsset };
