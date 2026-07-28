import "server-only";

import { encryptSocialProviderToken } from "@/features/twitter-automation/social-token-crypto";
import { createSocialAutomationUrl } from "@/features/twitter-automation/x-oauth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNEL_URL = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

type SocialMediaRow = {
  id: number;
  "Social Media": string;
  "Account Name": string;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type YouTubeChannelResponse = {
  items?: Array<{
    id?: string;
    snippet?: { customUrl?: string; title?: string };
  }>;
};

function getRequiredEnvironmentValue(name: "YOUTUBE_OAUTH_CLIENT_ID" | "YOUTUBE_OAUTH_CLIENT_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for YouTube OAuth.`);
  return value;
}

export function getYouTubeOAuthConfig() {
  const clientId = getRequiredEnvironmentValue("YOUTUBE_OAUTH_CLIENT_ID");
  const clientSecret = getRequiredEnvironmentValue("YOUTUBE_OAUTH_CLIENT_SECRET");
  const callbackUrl = createSocialAutomationUrl("/api/twitter-automation/oauth/youtube/callback").toString();
  return { clientId, clientSecret, callbackUrl };
}

export function createYouTubeAuthorizationUrl({ clientId, callbackUrl, state }: {
  clientId: string;
  callbackUrl: string;
  state: string;
}) {
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  return url;
}

export async function getYouTubeSocialMediaAccount(socialMediaId: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_medias")
    .select('id,"Social Media","Account Name"')
    .eq("id", socialMediaId)
    .maybeSingle<SocialMediaRow>();

  if (error) throw new Error("The social media account could not be loaded.");
  if (!data || data["Social Media"].trim().toLocaleLowerCase() !== "youtube") return null;
  return data;
}

export async function exchangeYouTubeAuthorizationCode({ code, config }: {
  code: string;
  config: ReturnType<typeof getYouTubeOAuthConfig>;
}) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.callbackUrl,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as GoogleTokenResponse | null;
  if (!response.ok || !payload?.access_token || !payload.refresh_token) {
    throw new Error("YouTube could not issue an access token.");
  }
  return payload;
}

export async function getYouTubeCurrentChannel(accessToken: string) {
  const response = await fetch(YOUTUBE_CHANNEL_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as YouTubeChannelResponse | null;
  const channel = payload?.items?.[0];
  if (!response.ok || !channel?.id) throw new Error("YouTube channel identity could not be verified.");
  return { id: channel.id, handle: channel.snippet?.customUrl ?? "", title: channel.snippet?.title ?? "" };
}

function normalizeYouTubeAccountName(accountName: string) {
  return accountName.trim().replace(/^@/u, "").toLocaleLowerCase();
}

export function isExpectedYouTubeChannel(expectedAccountName: string, channel: { handle: string; title: string }) {
  const expected = normalizeYouTubeAccountName(expectedAccountName);
  return [channel.handle, channel.title].some((value) => normalizeYouTubeAccountName(value) === expected);
}

export async function saveYouTubeConnection({ account, channel, token }: {
  account: SocialMediaRow;
  channel: { id: string; handle: string; title: string };
  token: GoogleTokenResponse;
}) {
  const expiresAt = typeof token.expires_in === "number"
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;
  const scopes = token.scope?.split(/\s+/u).filter(Boolean) ?? YOUTUBE_SCOPES;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("social_media_connections")
    .upsert({
      social_media_id: account.id,
      provider: "youtube",
      provider_account_id: channel.id,
      encrypted_access_token: encryptSocialProviderToken(token.access_token!),
      encrypted_refresh_token: token.refresh_token ? encryptSocialProviderToken(token.refresh_token) : null,
      token_expires_at: expiresAt,
      granted_scopes: scopes,
      status: "connected",
      last_error_code: null,
      last_error_message: null,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      last_validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "social_media_id" });
  if (error) throw new Error("The YouTube connection could not be saved.");
}
