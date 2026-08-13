"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type StagedVideoPurpose = "manual-video" | "automation-video";
type StagedVideo = {
  path: string;
  sourceUrl: string;
  mimeType: "video/mp4" | "video/webm";
};

export async function stageBrowserVideo(blob: Blob, purpose: StagedVideoPurpose, outputId?: string): Promise<StagedVideo> {
  const mimeType: "video/mp4" | "video/webm" = blob.type === "video/mp4" ? "video/mp4" : "video/webm";
  if (!blob.size || blob.size > 100 * 1024 * 1024) throw new Error("video_too_large");

  const createResponse = await fetch("/api/twitter-automation/media-stage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "create-upload", purpose, mimeType, ...(outputId ? { outputId } : {}) }),
  });
  const upload = await createResponse.json().catch(() => null) as { path?: string; token?: string } | null;
  if (!createResponse.ok || !upload?.path || !upload.token) throw new Error("media_stage_unavailable");

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from("social-studio-automation").uploadToSignedUrl(upload.path, upload.token, blob, {
    contentType: mimeType,
    cacheControl: "31536000",
  });
  if (error) throw new Error("media_stage_upload_failed");

  const deliveryResponse = await fetch("/api/twitter-automation/media-stage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "create-delivery-url", path: upload.path }),
  });
  const delivery = await deliveryResponse.json().catch(() => null) as { sourceUrl?: string } | null;
  if (!deliveryResponse.ok || !delivery?.sourceUrl) throw new Error("media_stage_unavailable");
  return { path: upload.path, sourceUrl: delivery.sourceUrl, mimeType };
}

type StagedImage = {
  path: string;
  sourceUrl: string;
  mimeType: "image/png";
};

export async function stageBrowserImage(blob: Blob, outputId: string, position = 0): Promise<StagedImage> {
  if (blob.type !== "image/png" || !blob.size || blob.size > 6 * 1024 * 1024) throw new Error("image_too_large");

  const createResponse = await fetch("/api/twitter-automation/media-stage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "create-upload", purpose: "automation-image", mimeType: "image/png", outputId, position }),
  });
  const upload = await createResponse.json().catch(() => null) as { path?: string; token?: string } | null;
  if (!createResponse.ok || !upload?.path || !upload.token) throw new Error("media_stage_unavailable");

  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from("social-studio-automation").uploadToSignedUrl(upload.path, upload.token, blob, {
    contentType: "image/png",
    cacheControl: "31536000",
  });
  if (error) throw new Error("media_stage_upload_failed");

  const deliveryResponse = await fetch("/api/twitter-automation/media-stage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "create-delivery-url", path: upload.path }),
  });
  const delivery = await deliveryResponse.json().catch(() => null) as { sourceUrl?: string } | null;
  if (!deliveryResponse.ok || !delivery?.sourceUrl) throw new Error("media_stage_unavailable");
  return { path: upload.path, sourceUrl: delivery.sourceUrl, mimeType: "image/png" };
}
