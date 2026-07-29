import "server-only";

import crypto from "node:crypto";
import { isIP } from "node:net";
import { decryptSocialProviderToken } from "@/features/twitter-automation/social-token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const X_MEDIA_UPLOAD_URL = "https://api.x.com/2/media/upload";
const X_CREATE_POST_URL = "https://api.x.com/2/tweets";
const PINTEREST_BOARDS_URL = "https://api.pinterest.com/v5/boards?page_size=100";
const PINTEREST_CREATE_PIN_URL = "https://api.pinterest.com/v5/pins";
const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";
const INSTAGRAM_ASSET_BUCKET = "social-publishing";
const YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_YOUTUBE_VIDEO_BYTES = 40 * 1024 * 1024;

type SocialMediaRow = {
  id: number;
  "Social Media": string;
  "Account Name": string;
};

type ConnectionRow = {
  id: string;
  provider: string;
  provider_account_id: string | null;
  encrypted_access_token: string | null;
  status: string;
};

type DataUrlAsset = {
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

type RemoteVideoAsset = {
  sourceUrl: string;
  mimeType: "video/mp4" | "video/webm";
};

type PinterestBoardsResponse = {
  items?: Array<{ id?: string; name?: string }>;
};

type PinterestCreatePinResponse = {
  id?: string;
};

type YouTubeCreateVideoResponse = {
  id?: string;
};

type InstagramCreateContainerResponse = {
  id?: string;
};

type InstagramContainerStatusResponse = {
  status_code?: "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";
};

type InstagramPublishResponse = {
  id?: string;
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

function isRemoteVideoAsset(asset: DataUrlAsset | RemoteVideoAsset): asset is RemoteVideoAsset {
  return "sourceUrl" in asset;
}

function isPrivateIpAddress(hostname: string) {
  const normalized = hostname.toLocaleLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return true;
  if (isIP(normalized) === 4) {
    const [first, second] = normalized.split(".").map(Number);
    return first === 10 || first === 127 || first === 0 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168);
  }
  return isIP(normalized) === 6 && (normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd"));
}

async function downloadYouTubeVideo(asset: RemoteVideoAsset) {
  let url: URL;
  try {
    url = new URL(asset.sourceUrl);
  } catch {
    throw new Error("invalid_media");
  }
  if (url.protocol !== "https:" || isPrivateIpAddress(url.hostname)) throw new Error("invalid_media");

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(90_000) });
  const declaredLength = Number(response.headers.get("content-length"));
  if (!response.ok || !response.headers.get("content-type")?.toLocaleLowerCase().startsWith("video/") || (Number.isFinite(declaredLength) && declaredLength > MAX_YOUTUBE_VIDEO_BYTES)) {
    throw new Error("invalid_media");
  }
  const video = Buffer.from(await response.arrayBuffer());
  if (!video.length || video.length > MAX_YOUTUBE_VIDEO_BYTES) throw new Error("invalid_media");
  return video;
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
    .select("id,provider,provider_account_id,encrypted_access_token,status")
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

function getConnectedAccessToken(connection: ConnectionRow) {
  if (connection.status !== "connected" || !connection.encrypted_access_token) {
    throw new Error("provider_not_configured");
  }
  return decryptSocialProviderToken(connection.encrypted_access_token);
}

async function markConnectionExpired(connectionId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("social_media_connections")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", connectionId);
}

export type PinterestBoard = { id: string; name: string };

export async function listPinterestBoards(socialMediaId: number): Promise<PinterestBoard[]> {
  const { account, connection } = await getPublishTarget(socialMediaId);
  if (providerForPlatform(account["Social Media"]) !== "pinterest" || connection.provider !== "pinterest") {
    throw new Error("provider_not_configured");
  }

  const accessToken = getConnectedAccessToken(connection);
  const response = await fetch(PINTEREST_BOARDS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as PinterestBoardsResponse | null;
  if (response.status === 401) {
    await markConnectionExpired(connection.id);
    throw new Error("token_expired");
  }
  if (!response.ok) throw new Error("pinterest_boards_unavailable");

  return (payload?.items ?? []).flatMap((board) => {
    if (!board.id || !board.name) return [];
    return [{ id: board.id, name: board.name }];
  });
}

async function publishToPinterest({ connection, caption, asset, boardId }: {
  connection: ConnectionRow;
  caption: string;
  asset?: DataUrlAsset;
  boardId?: string;
}) {
  if (!asset) throw new Error("invalid_media");
  if (!boardId) throw new Error("pinterest_board_required");

  const image = parseImageDataUrl(asset);
  const accessToken = getConnectedAccessToken(connection);
  const response = await fetch(PINTEREST_CREATE_PIN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: caption.slice(0, 100),
      description: caption,
      board_id: boardId,
      media_source: {
        source_type: "image_base64",
        content_type: asset.mimeType,
        data: image.toString("base64"),
      },
    }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as PinterestCreatePinResponse | null;
  if (response.status === 401) {
    await markConnectionExpired(connection.id);
    throw new Error("token_expired");
  }
  if (!response.ok || !payload?.id) throw new Error("provider_publish_failed");

  return { postId: payload.id, postUrl: `https://www.pinterest.com/pin/${payload.id}/` };
}

function extensionForImage(mimeType: DataUrlAsset["mimeType"]) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function uploadInstagramImage(asset: DataUrlAsset) {
  const image = parseImageDataUrl(asset);
  const path = `instagram/${crypto.randomUUID()}.${extensionForImage(asset.mimeType)}`;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage
    .from(INSTAGRAM_ASSET_BUCKET)
    .upload(path, image, { contentType: asset.mimeType, cacheControl: "3600", upsert: false });
  if (error) throw new Error("instagram_media_upload_failed");

  const { data } = supabase.storage.from(INSTAGRAM_ASSET_BUCKET).getPublicUrl(path);
  if (!data.publicUrl) {
    await supabase.storage.from(INSTAGRAM_ASSET_BUCKET).remove([path]);
    throw new Error("instagram_media_upload_failed");
  }
  return { path, publicUrl: data.publicUrl };
}

async function removeInstagramImage(path: string) {
  const supabase = createSupabaseAdminClient();
  await supabase.storage.from(INSTAGRAM_ASSET_BUCKET).remove([path]);
}

async function waitForInstagramContainer(containerId: string, accessToken: string) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const url = new URL(`${INSTAGRAM_GRAPH_URL}/${containerId}`);
    url.searchParams.set("fields", "status_code");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as InstagramContainerStatusResponse | null;
    if (response.status === 401) throw new Error("token_expired");
    if (!response.ok || payload?.status_code === "ERROR" || payload?.status_code === "EXPIRED") {
      throw new Error("instagram_container_failed");
    }
    if (payload?.status_code === "FINISHED" || payload?.status_code === "PUBLISHED") return;
    await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error("instagram_container_timeout");
}

async function publishToInstagram({ connection, caption, asset }: {
  connection: ConnectionRow;
  caption: string;
  asset?: DataUrlAsset;
}) {
  if (!asset) throw new Error("instagram_image_required");
  if (!connection.provider_account_id) throw new Error("provider_not_configured");

  const accessToken = getConnectedAccessToken(connection);
  const uploadedAsset = await uploadInstagramImage(asset);
  try {
    const createResponse = await fetch(`${INSTAGRAM_GRAPH_URL}/${connection.provider_account_id}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ image_url: uploadedAsset.publicUrl, caption }),
      cache: "no-store",
    });
    const createPayload = await createResponse.json().catch(() => null) as InstagramCreateContainerResponse | null;
    if (createResponse.status === 401) throw new Error("token_expired");
    if (!createResponse.ok || !createPayload?.id) throw new Error("instagram_container_failed");

    await waitForInstagramContainer(createPayload.id, accessToken);
    const publishResponse = await fetch(`${INSTAGRAM_GRAPH_URL}/${connection.provider_account_id}/media_publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ creation_id: createPayload.id }),
      cache: "no-store",
    });
    const publishPayload = await publishResponse.json().catch(() => null) as InstagramPublishResponse | null;
    if (publishResponse.status === 401) throw new Error("token_expired");
    if (!publishResponse.ok || !publishPayload?.id) throw new Error("provider_publish_failed");
    return { postId: publishPayload.id, postUrl: `https://www.instagram.com/p/${publishPayload.id}/` };
  } catch (error) {
    if (error instanceof Error && error.message === "token_expired") {
      await markConnectionExpired(connection.id);
    }
    throw error;
  } finally {
    await removeInstagramImage(uploadedAsset.path);
  }
}

function createMultipartVideoBody({ caption, video, mimeType }: { caption: string; video: Buffer; mimeType: RemoteVideoAsset["mimeType"] }) {
  const boundary = `foxiesdeck-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    snippet: {
      title: caption.replace(/\s+/gu, " ").trim().slice(0, 100),
      description: caption.slice(0, 5000),
      categoryId: "27",
    },
    // New unverified API projects must upload privately until Google audits the project.
    status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
  });
  const start = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const end = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { boundary, body: Buffer.concat([start, video, end]) };
}

async function publishToYouTube({ connection, caption, asset }: {
  connection: ConnectionRow;
  caption: string;
  asset?: DataUrlAsset | RemoteVideoAsset;
}) {
  if (!asset || !isRemoteVideoAsset(asset)) throw new Error("youtube_video_required");

  const [accessToken, video] = await Promise.all([
    Promise.resolve(getConnectedAccessToken(connection)),
    downloadYouTubeVideo(asset),
  ]);
  const multipart = createMultipartVideoBody({ caption, video, mimeType: asset.mimeType });
  const response = await fetch(YOUTUBE_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${multipart.boundary}`,
    },
    body: multipart.body,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as YouTubeCreateVideoResponse | null;
  if (response.status === 401) {
    await markConnectionExpired(connection.id);
    throw new Error("token_expired");
  }
  if (!response.ok || !payload?.id) throw new Error("provider_publish_failed");
  return { postId: payload.id, postUrl: `https://www.youtube.com/watch?v=${payload.id}` };
}

export async function publishSocialContent({ socialMediaId, caption, asset, pinterestBoardId }: {
  socialMediaId: number;
  caption: string;
  asset?: DataUrlAsset | RemoteVideoAsset;
  pinterestBoardId?: string;
}) {
  const { account, connection } = await getPublishTarget(socialMediaId);
  const provider = providerForPlatform(account["Social Media"]);
  if (!provider || provider !== connection.provider) throw new Error("provider_not_configured");
  if (provider === "x") return publishToX({ account, connection, caption, asset: asset && !isRemoteVideoAsset(asset) ? asset : undefined });
  if (account["Social Media"].trim().toLocaleLowerCase() === "instagram") {
    return publishToInstagram({ connection, caption, asset: asset && !isRemoteVideoAsset(asset) ? asset : undefined });
  }
  if (provider === "pinterest") return publishToPinterest({ connection, caption, asset: asset && !isRemoteVideoAsset(asset) ? asset : undefined, boardId: pinterestBoardId });
  if (provider === "youtube") return publishToYouTube({ connection, caption, asset });
  throw new Error("provider_not_configured");
}

export type { DataUrlAsset, RemoteVideoAsset };
