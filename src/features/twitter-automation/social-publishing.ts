import "server-only";

import { decryptSocialProviderToken } from "@/features/twitter-automation/social-token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const X_MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";
const X_CREATE_POST_URL = "https://api.x.com/2/tweets";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type SocialMediaRow = {
  id: number;
  "Social Media": string;
  "Account Name": string;
};

type ConnectionRow = {
  id: string;
  provider: string;
  encrypted_access_token: string | null;
  status: string;
};

type DataUrlAsset = {
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

function providerForPlatform(platform: string) {
  const key = platform.trim().toLocaleLowerCase();
  if (key === "x") return "x";
  if (key === "instagram" || key === "facebook" || key === "threads") return "meta";
  if (key === "tiktok") return "tiktok";
  if (key === "youtube") return "youtube";
  if (key === "pinterest") return "pinterest";
  return null;
}

function parseImageDataUrl(asset: DataUrlAsset) {
  const match = asset.dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/u);
  if (!match || match[1] !== asset.mimeType) throw new Error("invalid_media");

  const data = Buffer.from(match[2], "base64");
  if (!data.length || data.length > MAX_IMAGE_BYTES) throw new Error("invalid_media");
  return data;
}

async function getPublishTarget(socialMediaId: number) {
  const supabase = createSupabaseAdminClient();
  const { data: account, error: accountError } = await supabase
    .from("social_medias")
    .select('id,"Social Media","Account Name"')
    .eq("id", socialMediaId)
    .maybeSingle<SocialMediaRow>();
  if (accountError || !account || account["Social Media"].trim().toLocaleLowerCase() === "email") {
    throw new Error("account_not_found");
  }

  const { data: connection, error: connectionError } = await supabase
    .from("social_media_connections")
    .select("id,provider,encrypted_access_token,status")
    .eq("social_media_id", account.id)
    .maybeSingle<ConnectionRow>();
  if (connectionError || !connection) throw new Error("provider_not_configured");

  return { account, connection };
}

async function uploadXImage(accessToken: string, asset: DataUrlAsset) {
  const image = parseImageDataUrl(asset);
  const response = await fetch(X_MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      media: image.toString("base64"),
      media_category: "tweet_image",
      media_type: asset.mimeType,
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: { id?: string; media_id?: string } } | null;
  const mediaId = payload?.data?.id ?? payload?.data?.media_id;
  if (!response.ok || !mediaId) throw new Error(response.status === 401 ? "token_expired" : "provider_publish_failed");
  return mediaId;
}

async function publishToX({ account, connection, caption, asset }: {
  account: SocialMediaRow;
  connection: ConnectionRow;
  caption: string;
  asset?: DataUrlAsset;
}) {
  if (connection.status !== "connected" || !connection.encrypted_access_token) throw new Error("provider_not_configured");
  const accessToken = decryptSocialProviderToken(connection.encrypted_access_token);
  const mediaId = asset ? await uploadXImage(accessToken, asset) : null;
  const response = await fetch(X_CREATE_POST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: caption,
      ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { data?: { id?: string } } | null;
  const postId = payload?.data?.id;
  if (!response.ok || !postId) {
    if (response.status === 401) {
      const supabase = createSupabaseAdminClient();
      await supabase.from("social_media_connections").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", connection.id);
      throw new Error("token_expired");
    }
    throw new Error("provider_publish_failed");
  }

  return {
    postId,
    postUrl: `https://x.com/${account["Account Name"].replace(/^@/u, "")}/status/${postId}`,
  };
}

export async function publishSocialContent({ socialMediaId, caption, asset }: {
  socialMediaId: number;
  caption: string;
  asset?: DataUrlAsset;
}) {
  const { account, connection } = await getPublishTarget(socialMediaId);
  const provider = providerForPlatform(account["Social Media"]);
  if (!provider || provider !== connection.provider) throw new Error("provider_not_configured");
  if (provider !== "x") throw new Error("provider_not_configured");
  return publishToX({ account, connection, caption, asset });
}

export type { DataUrlAsset };
