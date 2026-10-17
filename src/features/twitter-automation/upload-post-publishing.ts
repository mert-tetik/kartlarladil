import "server-only";

import crypto from "node:crypto";
import { isLanguageCode } from "@/data/languages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createTitleOnlySocialTitle, getSocialDownloadTitle } from "@/features/twitter-automation/social-video-titles";
import { normalizeUploadPostPlatform, UPLOAD_POST_CONTENT_PLATFORMS } from "@/features/twitter-automation/upload-post-capabilities";

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

async function submitUpload(endpoint: string, form: FormData, requestId: string, platform: string) {
  const apiKey = getRequiredEnvironmentValue("UPLOAD_POST_API_KEY");
  const response = await fetch(`${UPLOAD_POST_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Apikey ${apiKey}`,
      "Idempotency-Key": requestId,
    },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json().catch(() => null) as UploadPostResponse | null;
  const providerResult = payload?.results?.[platform];
  if (!response.ok || !payload?.success || providerResult?.success === false || providerResult?.error) {
    console.error("[upload-post] publish rejected", {
      endpoint,
      platform,
      requestId,
      status: response.status,
      providerError: providerResult?.error ?? payload?.message ?? null,
    });
    throw new Error("upload_post_rejected");
  }

  const firstResult = Object.values(payload.results ?? {}).find((result) => typeof result?.url === "string");
  return {
    requestId: payload.request_id ?? null,
    jobId: payload.job_id ?? null,
    postUrl: firstResult?.url ?? null,
  };
}

export async function publishWithUploadPost({ socialMediaId, caption, title, nativeLanguage, learningLanguage, asset, assets, scheduledFor, requestId, options }: {
  socialMediaId: number;
  caption: string;
  title?: string;
  nativeLanguage?: string;
  learningLanguage?: string;
  asset?: DataUrlAsset | RemoteVideoAsset;
  assets?: DataUrlAsset[];
  scheduledFor?: string;
  requestId?: string;
  options?: UploadPostPublishOptions;
}) {
  const target = await getTarget(socialMediaId);
  if (target.platform === "reddit") throw new Error("upload_post_reddit_unavailable");
  if (assets?.length && target.platform === "pinterest" && assets.length > 5) throw new Error("upload_post_carousel_limit");
  const supportedPlatforms = assets?.length ? UPLOAD_POST_CONTENT_PLATFORMS.image : !asset ? UPLOAD_POST_CONTENT_PLATFORMS.text : isRemoteVideoAsset(asset) ? UPLOAD_POST_CONTENT_PLATFORMS.video : UPLOAD_POST_CONTENT_PLATFORMS.image;
  if (!supportedPlatforms.has(target.platform)) throw new Error("upload_post_unsupported_content");

  const hasMedia = Boolean(asset || assets?.length);
  const requestedNativeLanguage = nativeLanguage ?? "";
  const requestedLearningLanguage = learningLanguage ?? "";
  const resolvedNativeLanguage = isLanguageCode(requestedNativeLanguage) ? requestedNativeLanguage : "en";
  const resolvedLearningLanguage = isLanguageCode(requestedLearningLanguage) ? requestedLearningLanguage : resolvedNativeLanguage;
  const explicitTitle = title?.trim();
  const defaultTitle = hasMedia ? getSocialDownloadTitle(resolvedNativeLanguage) : caption;
  const providerTitle = explicitTitle || (
    hasMedia && TITLE_ONLY_PLATFORMS.has(target.platform)
      ? createTitleOnlySocialTitle(caption, resolvedNativeLanguage, resolvedLearningLanguage)
      : defaultTitle
  );

  const form = new FormData();
  form.append("user", target.profileUsername);
  form.append("platform[]", target.platform);
  form.append("title", providerTitle);
  form.append("description", caption);
  const uploadRequestId = requestId ?? crypto.randomUUID();
  form.append("request_id", uploadRequestId);
  if (scheduledFor) {
    const scheduledDate = new Date(scheduledFor);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) throw new Error("invalid_scheduled_date");
    form.append("scheduled_date", scheduledDate.toISOString());
    form.append("timezone", "Europe/Istanbul");
  }
  appendPlatformSettings(form, target.platform, providerTitle, options);

  if (assets?.length) {
    assets.forEach((carouselAsset, index) => {
      const image = parseImageDataUrl(carouselAsset);
      form.append("photos[]", new Blob([image], { type: carouselAsset.mimeType }), `foxiesdeck-carousel-${index + 1}.${getExtension(carouselAsset.mimeType)}`);
    });
    return submitUpload("/upload_photos", form, uploadRequestId, target.platform);
  }

  if (!asset) return submitUpload("/upload_text", form, uploadRequestId, target.platform);

  if (isRemoteVideoAsset(asset)) {
    const source = new URL(asset.sourceUrl);
    if (source.protocol !== "https:") throw new Error("invalid_media");
    form.append("video", source.toString());
    return submitUpload("/upload", form, uploadRequestId, target.platform);
  }

  const image = parseImageDataUrl(asset);
  form.append("photos[]", new Blob([image], { type: asset.mimeType }), `foxiesdeck.${getExtension(asset.mimeType)}`);
  return submitUpload("/upload_photos", form, uploadRequestId, target.platform);
}

export type { DataUrlAsset, RemoteVideoAsset };
