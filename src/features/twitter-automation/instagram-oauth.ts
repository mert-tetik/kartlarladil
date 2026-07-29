import "server-only";

import { encryptSocialProviderToken } from "@/features/twitter-automation/social-token-crypto";
import { createSocialAutomationUrl } from "@/features/twitter-automation/x-oauth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const INSTAGRAM_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_LONG_LIVED_TOKEN_URL = "https://graph.instagram.com/access_token";
const INSTAGRAM_CURRENT_USER_URL = "https://graph.instagram.com/me?fields=user_id,username,account_type";
const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

type SocialMediaRow = {
  id: number;
  "Social Media": string;
  "Account Name": string;
};

type InstagramTokenResponse = {
  access_token?: string;
  user_id?: string | number;
  expires_in?: number;
};

type InstagramCurrentUserResponse = {
  user_id?: string | number;
  id?: string | number;
  username?: string;
  account_type?: string;
};

function getRequiredEnvironmentValue(name: "INSTAGRAM_OAUTH_APP_ID" | "INSTAGRAM_OAUTH_APP_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Instagram OAuth.`);
  return value;
}

export function getInstagramOAuthConfig() {
  const appId = getRequiredEnvironmentValue("INSTAGRAM_OAUTH_APP_ID");
  const appSecret = getRequiredEnvironmentValue("INSTAGRAM_OAUTH_APP_SECRET");
  const callbackUrl = createSocialAutomationUrl("/api/twitter-automation/oauth/instagram/callback").toString();
  return { appId, appSecret, callbackUrl };
}

export function createInstagramAuthorizationUrl({ appId, callbackUrl, state }: {
  appId: string;
  callbackUrl: string;
  state: string;
}) {
  const url = new URL(INSTAGRAM_AUTHORIZE_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url;
}

export async function getInstagramSocialMediaAccount(socialMediaId: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_medias")
    .select('id,"Social Media","Account Name"')
    .eq("id", socialMediaId)
    .maybeSingle<SocialMediaRow>();

  if (error) throw new Error("The social media account could not be loaded.");
  if (!data || data["Social Media"].trim().toLocaleLowerCase() !== "instagram") return null;
  return data;
}

export async function exchangeInstagramAuthorizationCode({ code, config }: {
  code: string;
  config: ReturnType<typeof getInstagramOAuthConfig>;
}) {
  const response = await fetch(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: "authorization_code",
      redirect_uri: config.callbackUrl,
      code,
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as InstagramTokenResponse | null;
  if (!response.ok || !payload?.access_token) throw new Error("Instagram could not issue an access token.");
  return payload;
}

export async function exchangeInstagramLongLivedToken(shortLivedToken: string, config: ReturnType<typeof getInstagramOAuthConfig>) {
  const url = new URL(INSTAGRAM_LONG_LIVED_TOKEN_URL);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", config.appSecret);
  url.searchParams.set("access_token", shortLivedToken);
  const response = await fetch(url, { cache: "no-store" });
  const payload = await response.json().catch(() => null) as InstagramTokenResponse | null;
  if (!response.ok || !payload?.access_token) throw new Error("Instagram could not issue a long-lived access token.");
  return payload;
}

export async function getInstagramCurrentUser(accessToken: string) {
  const response = await fetch(INSTAGRAM_CURRENT_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as InstagramCurrentUserResponse | null;
  const id = payload?.user_id ?? payload?.id;
  const accountType = payload?.account_type?.toLocaleUpperCase();
  if (!response.ok || !id || !payload?.username || (accountType !== "BUSINESS" && accountType !== "CREATOR")) {
    throw new Error("Instagram professional account identity could not be verified.");
  }
  return { id: String(id), username: payload.username, accountType };
}

function normalizeInstagramAccountName(accountName: string) {
  return accountName.trim().replace(/^@/u, "").toLocaleLowerCase();
}

export function isExpectedInstagramAccount(expectedAccountName: string, username: string) {
  return normalizeInstagramAccountName(expectedAccountName) === normalizeInstagramAccountName(username);
}

export async function saveInstagramConnection({ account, currentUser, token }: {
  account: SocialMediaRow;
  currentUser: { id: string; username: string; accountType: string };
  token: InstagramTokenResponse;
}) {
  const expiresAt = typeof token.expires_in === "number"
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("social_media_connections")
    .upsert({
      social_media_id: account.id,
      provider: "meta",
      provider_account_id: currentUser.id,
      encrypted_access_token: encryptSocialProviderToken(token.access_token!),
      encrypted_refresh_token: null,
      token_expires_at: expiresAt,
      granted_scopes: INSTAGRAM_SCOPES,
      status: "connected",
      last_error_code: null,
      last_error_message: null,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      last_validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "social_media_id" });
  if (error) throw new Error("The Instagram connection could not be saved.");
}
