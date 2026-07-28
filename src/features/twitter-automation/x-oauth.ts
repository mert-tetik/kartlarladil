import "server-only";

import { encryptSocialProviderToken } from "@/features/twitter-automation/social-token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_CURRENT_USER_URL = "https://api.x.com/2/users/me?user.fields=username";
const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"];

type SocialMediaRow = {
  id: number;
  "Social Media": string;
  "Account Name": string;
};

type XTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type XCurrentUserResponse = {
  data?: {
    id?: string;
    username?: string;
  };
};

function getOAuthBaseUrl() {
  const rawUrl = process.env.SOCIAL_AUTOMATION_OAUTH_BASE_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!rawUrl) throw new Error("SOCIAL_AUTOMATION_OAUTH_BASE_URL is required for X OAuth.");

  try {
    return new URL(rawUrl).origin;
  } catch {
    throw new Error("SOCIAL_AUTOMATION_OAUTH_BASE_URL must be an absolute URL.");
  }
}

function getRequiredEnvironmentValue(name: "X_OAUTH_CLIENT_ID" | "X_OAUTH_CLIENT_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for X OAuth.`);
  return value;
}

export function getXOAuthConfig() {
  const clientId = getRequiredEnvironmentValue("X_OAUTH_CLIENT_ID");
  const clientSecret = getRequiredEnvironmentValue("X_OAUTH_CLIENT_SECRET");
  const callbackUrl = new URL("/api/twitter-automation/oauth/x/callback", getOAuthBaseUrl()).toString();

  return { clientId, clientSecret, callbackUrl };
}

export function createSocialAutomationUrl(pathname: string) {
  return new URL(pathname, getOAuthBaseUrl());
}

export function createXAuthorizationUrl({ clientId, callbackUrl, state, codeChallenge }: {
  clientId: string;
  callbackUrl: string;
  state: string;
  codeChallenge: string;
}) {
  const url = new URL(X_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("scope", X_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function getXSocialMediaAccount(socialMediaId: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("social_medias")
    .select('id,"Social Media","Account Name"')
    .eq("id", socialMediaId)
    .maybeSingle<SocialMediaRow>();

  if (error) throw new Error("The social media account could not be loaded.");
  if (!data || data["Social Media"].trim().toLocaleLowerCase() !== "x") return null;
  return data;
}

export async function exchangeXAuthorizationCode({ code, codeVerifier, config }: {
  code: string;
  codeVerifier: string;
  config: ReturnType<typeof getXOAuthConfig>;
}) {
  const authorization = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: config.callbackUrl,
      code_verifier: codeVerifier,
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as XTokenResponse | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error("X could not issue an access token.");
  }

  return payload;
}

export async function getXCurrentUser(accessToken: string) {
  const response = await fetch(X_CURRENT_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as XCurrentUserResponse | null;
  const user = payload?.data;
  if (!response.ok || !user?.id || !user.username) {
    throw new Error("X account identity could not be verified.");
  }

  return { id: user.id, username: user.username };
}

function normalizeXAccountName(accountName: string) {
  return accountName.trim().replace(/^@/u, "").toLocaleLowerCase();
}

export function isExpectedXAccount(expectedAccountName: string, username: string) {
  return normalizeXAccountName(expectedAccountName) === normalizeXAccountName(username);
}

export async function saveXConnection({ account, currentUser, token }: {
  account: SocialMediaRow;
  currentUser: { id: string; username: string };
  token: XTokenResponse;
}) {
  const expiresAt = typeof token.expires_in === "number"
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;
  const scopes = token.scope?.split(/\s+/u).filter(Boolean) ?? X_SCOPES;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("social_media_connections")
    .upsert({
      social_media_id: account.id,
      provider: "x",
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

  if (error) throw new Error("The X connection could not be saved.");
}
