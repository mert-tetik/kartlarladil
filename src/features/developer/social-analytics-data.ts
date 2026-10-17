import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  SocialAnalyticsAccount,
  SocialAnalyticsAccountStatus,
  SocialAnalyticsData,
  SocialAnalyticsMetrics,
  SocialAnalyticsPost,
  SocialAnalyticsPostStats,
  SocialAnalyticsPostsPage,
  SocialAnalyticsSeriesPoint,
} from "@/features/developer/social-analytics-types";

const UPLOAD_POST_BASE_URL = "https://api.upload-post.com/api";
const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const ANALYTICS_PLATFORMS = new Set([
  "instagram",
  "tiktok",
  "linkedin",
  "facebook",
  "x",
  "youtube",
  "threads",
  "pinterest",
  "reddit",
  "bluesky",
  "google_business",
]);
const MEDIA_PLATFORMS = new Set([
  ...ANALYTICS_PLATFORMS,
]);

type SocialMediaRow = {
  id: number;
  "Social Media": string | null;
  "Account Name": string | null;
  "upload-post profile username": string | null;
  description: string | null;
};

type ConnectionRow = {
  social_media_id: number;
  provider: string | null;
  provider_account_id: string | null;
  status: string | null;
  last_validated_at: string | null;
  last_error_message: string | null;
};

type FacebookPage = {
  pageId: string;
  pageName: string | null;
  profile: string | null;
};

type JsonRecord = Record<string, unknown>;
type UploadPostJsonResponse = { ok: boolean; error: string | null; payload: unknown };

const EMPTY_METRICS: SocialAnalyticsMetrics = {
  followers: null,
  following: null,
  postsCount: null,
  reach: null,
  views: null,
  impressions: null,
  profileViews: null,
  likes: null,
  comments: null,
  shares: null,
  saves: null,
  engagement: null,
  pinClicks: null,
  outboundClicks: null,
  watchTimeMinutes: null,
  averageViewDurationSeconds: null,
  metricType: null,
  metricLabel: null,
  exposureSeries: [],
};

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asSeries(value: unknown) {
  if (!Array.isArray(value)) return [] as SocialAnalyticsSeriesPoint[];
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    const date = asText(record?.date);
    const number = asNumber(record?.value);
    return date && number !== null ? [{ date, value: number }] : [];
  });
}

function profileHandleFromPayload(value: unknown, platform: string) {
  const record = asRecord(value);
  const profile = asRecord(record?.profile);
  const socialAccounts = asRecord(profile?.social_accounts);
  if (!socialAccounts) return null;

  const platformAliases = platform === "x" ? ["x", "twitter"] : [platform];
  for (const alias of platformAliases) {
    const account = asRecord(socialAccounts[alias]);
    const handle = asText(account?.handle);
    if (handle) return handle;
    const username = asText(account?.username);
    if (platform === "youtube" && username && /^UC[\w-]{10,}$/u.test(username)) return username;
  }
  return null;
}

function normalizePlatform(value: string) {
  const normalized = value.trim().toLocaleLowerCase().replace(/[()]/gu, "").replace(/[\s./-]+/gu, "_");
  const aliases: Record<string, string> = {
    twitter: "x",
    twitter_x: "x",
    x_twitter: "x",
    youtube_shorts: "youtube",
    google_business_profile: "google_business",
    google_my_business: "google_business",
  };
  return aliases[normalized] ?? normalized;
}

function normalizeComparableText(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function uploadPostProfileCandidates(profileUsername: string) {
  const normalized = profileUsername
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}_-]+/gu, "");
  return [...new Set([profileUsername, normalized].filter(Boolean))];
}

async function resolveUploadPostProfile(profileUsername: string) {
  let lastResponse: UploadPostJsonResponse = { ok: false, error: "upload_post_profile_unavailable", payload: null };
  for (const candidate of uploadPostProfileCandidates(profileUsername)) {
    const response = await fetchUploadPostJson(`/uploadposts/users/${encodeURIComponent(candidate)}`);
    if (response.ok) return { profileUsername: candidate, response };
    lastResponse = response;
  }
  return { profileUsername, response: lastResponse };
}

function facebookPagesFromPayload(value: unknown): FacebookPage[] {
  const record = asRecord(value);
  const data = asRecord(record?.data);
  const rawPages = Array.isArray(record?.pages) ? record.pages : Array.isArray(data?.pages) ? data.pages : [];
  return rawPages.flatMap((entry) => {
    const page = asRecord(entry);
    const pageId = asText(page?.page_id ?? page?.id);
    if (!pageId) return [];
    return [{
      pageId,
      pageName: asText(page?.page_name ?? page?.name),
      profile: asText(page?.profile),
    }];
  });
}

function selectFacebookPage(pages: FacebookPage[], accountName: string) {
  const target = normalizeComparableText(accountName);
  if (!target) return pages.length === 1 ? pages[0] : null;

  return pages.find((page) => normalizeComparableText(page.pageName) === target)
    ?? pages.find((page) => {
      const pageName = normalizeComparableText(page.pageName);
      return pageName.length > 0 && (pageName.includes(target) || target.includes(pageName));
    })
    ?? (pages.length === 1 ? pages[0] : null);
}

async function getFacebookPageIds(
  profileUsername: string,
  accounts: SocialAnalyticsAccount[],
  connectionBySocialMediaId: Map<number, ConnectionRow>,
  profilePayload?: unknown,
) {
  const pageIds = new Map<number, string>();
  const unresolvedAccounts: SocialAnalyticsAccount[] = [];

  for (const account of accounts.filter((candidate) => candidate.platform === "facebook")) {
    const connectedPageId = connectionBySocialMediaId.get(account.id)?.provider_account_id?.trim();
    if (connectedPageId) pageIds.set(account.id, connectedPageId);
    else unresolvedAccounts.push(account);
  }

  if (!unresolvedAccounts.length) return pageIds;

  const response = await fetchUploadPostJson(`/uploadposts/facebook/pages?profile=${encodeURIComponent(profileUsername)}`);
  const pages = response.ok ? facebookPagesFromPayload(response.payload) : [];
  const profileRecord = asRecord(profilePayload);
  const profilePageId = asText(profileRecord?.facebook_page_id);
  const profilePageName = asText(profileRecord?.facebook_page_name);
  if (profilePageId && !pages.some((page) => page.pageId === profilePageId)) {
    pages.unshift({ pageId: profilePageId, pageName: profilePageName, profile: profileUsername });
  }
  if (!pages.length) {
    console.error("[social-analytics] Facebook page lookup failed", {
      profileUsername,
      error: response.error,
      accountIds: unresolvedAccounts.map((account) => account.id),
    });
    return pageIds;
  }

  for (const account of unresolvedAccounts) {
    const page = selectFacebookPage(pages, account.accountName);
    if (page) pageIds.set(account.id, page.pageId);
    else {
      console.error("[social-analytics] Facebook page could not be matched to account", {
        accountId: account.id,
        accountName: account.accountName,
        profileUsername,
        availablePages: pages.map((candidate) => ({ pageId: candidate.pageId, pageName: candidate.pageName })),
      });
    }
  }

  return pageIds;
}

function toMetrics(value: unknown): SocialAnalyticsMetrics | null {
  const record = asRecord(value);
  if (!record) return null;
  if (record.success === false) return null;

  const metricLabels = asRecord(record.metric_labels);
  const exposureSeries = asSeries(record.reach_timeseries ?? record.impressions_timeseries);
  const engagement = asNumber(record.engagement);
  return {
    ...EMPTY_METRICS,
    followers: asNumber(record.followers),
    following: asNumber(record.following),
    postsCount: asNumber(record.posts_count ?? record.postsCount ?? record.video_count),
    reach: asNumber(record.reach),
    views: asNumber(record.views),
    impressions: asNumber(record.impressions),
    profileViews: asNumber(record.profileViews ?? record.profile_views),
    likes: asNumber(record.likes),
    comments: asNumber(record.comments),
    shares: asNumber(record.shares),
    saves: asNumber(record.saves),
    engagement: engagement ?? ((asNumber(record.likes) ?? 0) + (asNumber(record.comments) ?? 0) + (asNumber(record.shares) ?? 0) + (asNumber(record.saves) ?? 0) || null),
    pinClicks: asNumber(record.pin_clicks),
    outboundClicks: asNumber(record.outbound_clicks),
    watchTimeMinutes: asNumber(record.watch_time_minutes),
    averageViewDurationSeconds: asNumber(record.average_view_duration_seconds),
    metricType: asText(record.metric_type),
    metricLabel: asText(metricLabels?.[asText(record.metric_type) ?? ""]),
    exposureSeries,
  };
}

function getApiKey() {
  return process.env.UPLOAD_POST_API_KEY?.trim() ?? "";
}

async function fetchUploadPostJson(path: string): Promise<UploadPostJsonResponse> {
  const apiKey = getApiKey();
  if (!apiKey) return { ok: false, error: "upload_post_not_configured", payload: null as unknown };

  try {
    const response = await fetch(`${UPLOAD_POST_BASE_URL}${path}`, {
      headers: { Authorization: `Apikey ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
      console.error("[social-analytics] Upload-Post request failed", {
        path,
        status: response.status,
        providerError: asText(asRecord(payload)?.error ?? asRecord(payload)?.message),
      });
      return { ok: false, error: `upload_post_http_${response.status}`, payload };
    }
    return { ok: true, error: null, payload };
  } catch (error) {
    console.error("[social-analytics] Upload-Post request threw an error", { path, error });
    return { ok: false, error: error instanceof Error && error.name === "TimeoutError" ? "upload_post_timeout" : "upload_post_network_error", payload: null as unknown };
  }
}

function statusMessage(status: SocialAnalyticsAccountStatus, detail?: string | null) {
  if (status === "not_configured") return "UPLOAD_POST_API_KEY yapılandırılmamış.";
  if (status === "profile_required") return "Supabase social_medias kaydında Upload-Post profil adı yok.";
  if (status === "unsupported") return "Bu platform için Upload-Post analytics desteği yok.";
  if (status === "error") return detail || "Upload-Post bu hesabın verisini getiremedi.";
  return null;
}

function toPost(value: unknown, platform: string): SocialAnalyticsPost | null {
  const record = asRecord(value);
  const id = asText(record?.id ?? record?.media_id ?? record?.pin_id ?? record?.post_id);
  if (!id) return null;
  return {
    id,
    platform,
    caption: asText(record?.caption ?? record?.title ?? record?.description),
    mediaType: asText(record?.media_type ?? record?.type),
    permalink: asText(record?.permalink ?? record?.url ?? record?.post_url),
    mediaUrl: asText(record?.media_url ?? record?.image_url ?? record?.thumbnail_url),
    timestamp: asText(record?.timestamp ?? record?.created_at ?? record?.published_at),
    stats: null,
  };
}

function mediaItemsFromPayload(value: unknown) {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  for (const candidate of [record?.media, record?.data, record?.items]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [] as unknown[];
}

function toPostStats(value: unknown): SocialAnalyticsPostStats | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    views: asNumber(record.views),
    reach: asNumber(record.reach),
    impressions: asNumber(record.impressions),
    likes: asNumber(record.likes),
    comments: asNumber(record.comments),
    shares: asNumber(record.shares),
    saves: asNumber(record.saves),
    favorites: asNumber(record.favorites),
  };
}

async function loadPostStats(post: SocialAnalyticsPost, profileUsername: string) {
  const params = new URLSearchParams({
    platform_post_id: post.id,
    platform: post.platform,
    user: profileUsername,
  });
  const response = await fetchUploadPostJson(`/uploadposts/post-analytics?${params.toString()}`);
  if (!response.ok) return post;
  const payload = asRecord(response.payload);
  const platforms = asRecord(payload?.platforms);
  const platformPayload = asRecord(platforms?.[post.platform]);
  const stats = toPostStats(platformPayload?.post_metrics);
  return stats ? { ...post, stats } : post;
}

export async function getSocialAnalyticsPosts(accountId: number, cursor?: string | null, limit = 12): Promise<SocialAnalyticsPostsPage> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_medias")
    .select('id,"Social Media","Account Name","upload-post profile username",description')
    .eq("id", accountId)
    .maybeSingle<SocialMediaRow>();
  if (error) throw error;
  if (!data) throw new Error("social_media_not_found");

  const platform = normalizePlatform(data["Social Media"] ?? "");
  const rawProfileUsername = data["upload-post profile username"]?.trim();
  if (!rawProfileUsername) throw new Error("upload_post_profile_not_configured");
  if (!MEDIA_PLATFORMS.has(platform)) throw new Error("upload_post_analytics_unsupported");

  const profileLookup = await resolveUploadPostProfile(rawProfileUsername);
  const profileUsername = profileLookup.profileUsername;
  if (!profileLookup.response.ok) throw new Error(profileLookup.response.error ?? "upload_post_profile_unavailable");

  const params = new URLSearchParams({ platform, user: profileUsername, limit: String(Math.max(1, Math.min(25, Math.round(limit)))) });
  if (cursor) params.set("cursor", cursor);
  const response = await fetchUploadPostJson(`/uploadposts/media?${params.toString()}`);
  if (!response.ok) throw new Error(response.error ?? "upload_post_media_unavailable");

  const record = asRecord(response.payload);
  if (record?.success === false) {
    const providerError = asText(record.error ?? record.message) ?? "upload_post_media_unavailable";
    console.error("[social-analytics] Upload-Post returned an unsuccessful media response", { accountId, platform, profileUsername, providerError });
    throw new Error(providerError);
  }
  const media = mediaItemsFromPayload(response.payload);
  const posts = media.flatMap((item) => {
    const post = toPost(item, platform);
    return post ? [post] : [];
  });
  const enrichedPosts = await Promise.all(posts.map((post) => loadPostStats(post, profileUsername)));
  const pagination = asRecord(record?.pagination);
  return {
    accountId,
    posts: enrichedPosts,
    hasMore: pagination?.has_more === true,
    nextCursor: asText(pagination?.next_cursor),
  };
}

function aggregateExposure(accounts: SocialAnalyticsAccount[]) {
  const byDate = new Map<string, number>();
  for (const account of accounts) {
    for (const point of account.metrics?.exposureSeries ?? []) {
      byDate.set(point.date, (byDate.get(point.date) ?? 0) + point.value);
    }
  }
  return [...byDate.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([date, value]) => ({ date, value }));
}

function createSummary(accounts: SocialAnalyticsAccount[]) {
  const numeric = (selector: (metrics: SocialAnalyticsMetrics) => number | null) => accounts.reduce((sum, account) => sum + (account.metrics ? selector(account.metrics) ?? 0 : 0), 0);
  return {
    totalAccounts: accounts.length,
    profileReadyAccounts: accounts.filter((account) => Boolean(account.profileUsername)).length,
    liveAccounts: accounts.filter((account) => account.status === "live").length,
    errorAccounts: accounts.filter((account) => account.status === "error").length,
    unsupportedAccounts: accounts.filter((account) => account.status === "unsupported").length,
    totalFollowers: numeric((metrics) => metrics.followers),
    totalReach: numeric((metrics) => metrics.reach),
    totalViews: numeric((metrics) => metrics.views ?? metrics.impressions),
    totalEngagement: numeric((metrics) => metrics.engagement),
    totalPosts: numeric((metrics) => metrics.postsCount),
  };
}

export async function getSocialAnalyticsData(days = DEFAULT_DAYS): Promise<SocialAnalyticsData> {
  const normalizedDays = Math.max(1, Math.min(MAX_DAYS, Math.round(days)));
  const supabase = createSupabaseAdminClient();
  const [{ data: socialMedias, error: socialMediaError }, { data: connections, error: connectionError }] = await Promise.all([
    supabase
      .from("social_medias")
      .select('id,"Social Media","Account Name","upload-post profile username",description')
      .order("id", { ascending: true })
      .returns<SocialMediaRow[]>(),
    supabase
      .from("social_media_connections")
      .select("social_media_id,provider,provider_account_id,status,last_validated_at,last_error_message")
      .returns<ConnectionRow[]>(),
  ]);
  if (socialMediaError) throw socialMediaError;
  if (connectionError) throw connectionError;

  const connectionBySocialMediaId = new Map((connections ?? []).map((connection) => [connection.social_media_id, connection]));
  const rows = (socialMedias ?? []).filter((row) => row["Social Media"]?.trim() && row["Account Name"]?.trim() && row["Social Media"]?.trim().toLocaleLowerCase() !== "email");
  const configured = Boolean(getApiKey());
  const accounts: SocialAnalyticsAccount[] = rows.map((row) => {
    const platform = normalizePlatform(row["Social Media"] ?? "");
    const profileUsername = row["upload-post profile username"]?.trim() || null;
    const connection = connectionBySocialMediaId.get(row.id);
    let status: SocialAnalyticsAccountStatus = configured ? "live" : "not_configured";
    if (configured && !profileUsername) status = "profile_required";
    if (configured && profileUsername && !ANALYTICS_PLATFORMS.has(platform)) status = "unsupported";
    return {
      id: row.id,
      platform,
      accountName: row["Account Name"]!.trim(),
      profileUsername,
      profileHandle: null,
      description: row.description,
      status,
      statusMessage: statusMessage(status),
      directConnectionStatus: connection?.status ?? null,
      directConnectionProvider: connection?.provider ?? null,
      directConnectionLastValidatedAt: connection?.last_validated_at ?? null,
      directConnectionError: connection?.last_error_message ?? null,
      metrics: null,
      recentPosts: [],
    };
  });

  if (!configured) {
    return {
      configured: false,
      fetchedAt: new Date().toISOString(),
      days: normalizedDays,
      summary: createSummary(accounts),
      exposureSeries: [],
      accounts,
    };
  }

  const groups = new Map<string, SocialAnalyticsAccount[]>();
  for (const account of accounts) {
    if (account.status !== "live" || !account.profileUsername) continue;
    const group = groups.get(account.profileUsername) ?? [];
    group.push(account);
    groups.set(account.profileUsername, group);
  }

  await Promise.all([...groups.entries()].map(async ([profileUsername, group]) => {
    const profileLookup = await resolveUploadPostProfile(profileUsername);
    const resolvedProfileUsername = profileLookup.profileUsername;
    const profileResponse = profileLookup.response;
    const facebookPageIds = await getFacebookPageIds(resolvedProfileUsername, group, connectionBySocialMediaId, profileResponse.payload);
    for (const account of group) account.profileUsername = resolvedProfileUsername;
    for (const account of group) {
      account.profileHandle = profileHandleFromPayload(profileResponse.payload, account.platform);
    }

    const facebookAccounts = group.filter((account) => account.platform === "facebook");
    const unresolvedFacebookAccounts = facebookAccounts.filter((account) => !facebookPageIds.has(account.id));
    for (const account of unresolvedFacebookAccounts) {
      account.status = "error";
      account.statusMessage = "Facebook Page ID bulunamadı. Upload-Post profilinde bu sayfayı bağlayın.";
    }

    const requestGroups: Array<{ accounts: SocialAnalyticsAccount[]; facebookPageId?: string }> = [];
    if (facebookAccounts.length === 1 && facebookPageIds.has(facebookAccounts[0].id)) {
      requestGroups.push({ accounts: group, facebookPageId: facebookPageIds.get(facebookAccounts[0].id) });
    } else {
      const nonFacebookAccounts = group.filter((account) => account.platform !== "facebook");
      if (nonFacebookAccounts.length) requestGroups.push({ accounts: nonFacebookAccounts });
      for (const account of facebookAccounts) {
        const facebookPageId = facebookPageIds.get(account.id);
        if (facebookPageId) requestGroups.push({ accounts: [account], facebookPageId });
      }
    }

    await Promise.all(requestGroups.map(async ({ accounts, facebookPageId }) => {
      const platforms = [...new Set(accounts.map((account) => account.platform))];
      const params = new URLSearchParams({ platforms: platforms.join(","), days: String(normalizedDays) });
      const linkedinAccount = accounts.find((account) => account.platform === "linkedin");
      const linkedinConnection = linkedinAccount ? connectionBySocialMediaId.get(linkedinAccount.id) : null;
      if (facebookPageId) params.set("page_id", facebookPageId);
      if (linkedinConnection?.provider_account_id) params.set("page_urn", linkedinConnection.provider_account_id);

      const response = await fetchUploadPostJson(`/analytics/${encodeURIComponent(resolvedProfileUsername)}?${params.toString()}`);
      const payload = asRecord(response.payload);
      for (const account of accounts) {
        const platformPayload = payload?.[account.platform];
        const platformRecord = asRecord(platformPayload);
        const platformError = asText(platformRecord?.error ?? platformRecord?.message);
        if (!response.ok || platformError || !platformRecord) {
          account.status = "error";
          account.statusMessage = statusMessage("error", platformError ?? response.error);
          continue;
        }
        account.metrics = toMetrics(platformPayload);
        account.status = account.metrics ? "live" : "error";
        account.statusMessage = account.metrics ? null : statusMessage("error");
      }
    }));
  }));

  return {
    configured: true,
    fetchedAt: new Date().toISOString(),
    days: normalizedDays,
    summary: createSummary(accounts),
    exposureSeries: aggregateExposure(accounts),
    accounts,
  };
}
