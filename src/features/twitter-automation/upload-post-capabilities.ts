export const UPLOAD_POST_CONTENT_TYPES = ["text", "image", "video"] as const;

export type UploadPostContentType = (typeof UPLOAD_POST_CONTENT_TYPES)[number];

export const UPLOAD_POST_CONTENT_PLATFORMS: Record<UploadPostContentType, ReadonlySet<string>> = {
  text: new Set([
    "x", "linkedin", "facebook", "threads", "bluesky", "discord", "telegram",
    "google_business", "slack", "mastodon", "nostr", "lemmy", "devto", "hashnode", "wordpress", "whop", "listmonk",
  ]),
  image: new Set([
    "tiktok", "instagram", "linkedin", "facebook", "x", "threads", "pinterest", "bluesky", "discord", "telegram",
    "google_business", "mastodon", "lemmy", "wordpress",
  ]),
  video: new Set([
    "tiktok", "instagram", "linkedin", "youtube", "facebook", "x", "threads", "pinterest", "bluesky", "discord", "telegram",
    "google_business", "mastodon", "wordpress",
  ]),
};

export function normalizeUploadPostPlatform(value: string) {
  const key = value.trim().toLocaleLowerCase().replace(/[()]/gu, "").replace(/[\s./-]+/gu, "_");
  const aliases: Record<string, string> = {
    twitter: "x",
    twitter_x: "x",
    x_twitter: "x",
    youtube_shorts: "youtube",
    google_business_profile: "google_business",
    google_my_business: "google_business",
    dev_to: "devto",
  };
  return aliases[key] ?? key;
}

export function supportsUploadPostContent(platform: string, contentType: UploadPostContentType) {
  return UPLOAD_POST_CONTENT_PLATFORMS[contentType].has(normalizeUploadPostPlatform(platform));
}

export function supportedUploadPostContentTypes(platform: string) {
  return UPLOAD_POST_CONTENT_TYPES.filter((contentType) => supportsUploadPostContent(platform, contentType));
}
