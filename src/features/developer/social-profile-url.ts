const PLATFORM_HOSTS: Record<string, string[]> = {
  x: ["x.com", "twitter.com"],
  instagram: ["instagram.com"],
  facebook: ["facebook.com"],
  youtube: ["youtube.com", "youtu.be"],
  tiktok: ["tiktok.com"],
  linkedin: ["linkedin.com"],
  threads: ["threads.com", "threads.net"],
  pinterest: ["pinterest.com"],
  reddit: ["reddit.com"],
  bluesky: ["bsky.app"],
};

function normalizePlatform(value: string) {
  const normalized = value.trim().toLocaleLowerCase().replace(/[()]/gu, "").replace(/[\s./-]+/gu, "_");
  const aliases: Record<string, string> = {
    twitter: "x",
    twitter_x: "x",
    x_twitter: "x",
    youtube_shorts: "youtube",
  };
  return aliases[normalized] ?? normalized;
}

function isAllowedHost(hostname: string, platform: string) {
  const host = hostname.toLocaleLowerCase().replace(/^www\./u, "");
  return (PLATFORM_HOSTS[platform] ?? []).some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
}

function looksLikeUrl(value: string) {
  return /^(?:https?:\/\/|www\.|(?:[a-z\d-]+\.)+[a-z]{2,}\/)/iu.test(value);
}

function providedProfileUrl(value: string, platform: string) {
  if (!looksLikeUrl(value)) return null;
  const candidate = /^https?:\/\//iu.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || !isAllowedHost(url.hostname, platform)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function cleanHandle(value: string) {
  const handle = value.trim().replace(/^@+/u, "").replace(/^\/+|\/+$/gu, "");
  return handle && !/\s/gu.test(handle) ? handle : null;
}

function encodePath(value: string) {
  return encodeURIComponent(value);
}

/** Builds a public profile URL from the public handle returned by Upload-Post. */
export function getSocialProfileUrl(platformValue: string, handleValue: string | null | undefined) {
  const platform = normalizePlatform(platformValue);
  const raw = handleValue?.trim();
  if (!raw) return null;

  if (looksLikeUrl(raw)) return providedProfileUrl(raw, platform);

  const handle = cleanHandle(raw);
  if (!handle) return null;

  switch (platform) {
    case "instagram":
      return `https://www.instagram.com/${encodePath(handle)}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${encodePath(handle)}`;
    case "youtube": {
      if (/^UC[\w-]{10,}$/u.test(handle)) return `https://www.youtube.com/channel/${encodePath(handle)}`;
      const legacyPath = /^(channel|c|user)\/(.+)$/iu.exec(handle);
      if (legacyPath) return `https://www.youtube.com/${legacyPath[1].toLowerCase()}/${encodePath(legacyPath[2]!)}`;
      return `https://www.youtube.com/@${encodePath(handle)}`;
    }
    case "x":
      return `https://x.com/${encodePath(handle)}`;
    case "facebook":
      return /^\d+$/u.test(handle) ? `https://www.facebook.com/profile.php?id=${encodeURIComponent(handle)}` : `https://www.facebook.com/${encodePath(handle)}`;
    case "threads":
      return `https://www.threads.com/@${encodePath(handle)}`;
    case "pinterest":
      return `https://www.pinterest.com/${encodePath(handle)}/`;
    case "linkedin":
      return `https://www.linkedin.com/in/${encodePath(handle)}`;
    case "reddit":
      return `https://www.reddit.com/user/${encodePath(handle)}`;
    case "bluesky":
      return `https://bsky.app/profile/${encodePath(handle)}`;
    default:
      return null;
  }
}
