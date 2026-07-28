import "server-only";

import { encryptSocialProviderToken } from "@/features/twitter-automation/social-token-crypto";
import { createSocialAutomationUrl } from "@/features/twitter-automation/x-oauth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PINTEREST_AUTHORIZE_URL = "https://www.pinterest.com/oauth/";
const PINTEREST_TOKEN_URL = "https://api.pinterest.com/v5/oauth/token";
const PINTEREST_CURRENT_USER_URL = "https://api.pinterest.com/v5/user_account";
const PINTEREST_SCOPES = ["user_accounts:read", "boards:read", "pins:write"];

type SocialMediaRow = {
  id: number;
  "Social Media": string;
  "Account Name": string;
};

type PinterestTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type PinterestCurrentUserResponse = {
  id?: string;
  username?: string;
};

function getRequiredEnvironmentValue(name: "PINTEREST_OAUTH_CLIENT_ID" | "PINTEREST_OAUTH_CLIENT_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Pinterest OAuth.`);
  return value;
}

export function getPinterestOAuthConfig() {
  const clientId = getRequiredEnvironmentValue("PINTEREST_OAUTH_CLIENT_ID");
  const clientSecret = getRequiredEnvironmentValue("PINTEREST_OAUTH_CLIENT_SECRET");
  const callbackUrl = createSocialAutomationUrl("/api/twitter-automation/oauth/pinterest/callback").toString();
  return { clientId, clientSecret, callbackUrl };
}

export function createPinterestAuthorizationUrl({ clientId, callbackUrl, state }: {
  clientId: string;
  callbackUrl: string;
  state: string;
}) {
  const url = new URL(PINTEREST_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("scope", PINTEREST_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url;
}

export async function getPinterestSocialMediaAccount(socialMediaId: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_medias")
    .select('id,"Social Media","Account Name"')
    .eq("id", socialMediaId)
    .maybeSingle<SocialMediaRow>();

  if (error) throw new Error("The social media account could not be loaded.");
  if (!data || data["Social Media"].trim().toLocaleLowerCase() !== "pinterest") return null;
  return data;
}

export async function exchangePinterestAuthorizationCode({ code, config }: {
  code: string;
  config: ReturnType<typeof getPinterestOAuthConfig>;
}) {
  const authorization = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(PINTEREST_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: config.callbackUrl,
      continuous_refresh: "true",
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as PinterestTokenResponse | null;
  if (!response.ok || !payload?.access_token) throw new Error("Pinterest could not issue an access token.");
  return payload;
}

export async function getPinterestCurrentUser(accessToken: string) {
  const response = await fetch(PINTEREST_CURRENT_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as PinterestCurrentUserResponse | null;
  if (!response.ok || !payload?.id || !payload.username) {
    throw new Error("Pinterest account identity could not be verified.");
  }
  return { id: payload.id, username: payload.username };
}

function normalizePinterestAccountName(accountName: string) {
  return accountName.trim().replace(/^@/u, "").toLocaleLowerCase();
}

export function isExpectedPinterestAccount(expectedAccountName: string, username: string) {
  return normalizePinterestAccountName(expectedAccountName) === normalizePinterestAccountName(username);
}

export async function savePinterestConnection({ account, currentUser, token }: {
  account: SocialMediaRow;
  currentUser: { id: string; username: string };
  token: PinterestTokenResponse;
}) {
  const expiresAt = typeof token.expires_in === "number"
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;
  const scopes = token.scope?.split(/[\s,]+/u).filter(Boolean) ?? PINTEREST_SCOPES;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("social_media_connections")
    .upsert({
      social_media_id: account.id,
      provider: "pinterest",
      provider_account_id: currentUser.id,
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

  if (error) throw new Error("The Pinterest connection could not be saved.");
}
