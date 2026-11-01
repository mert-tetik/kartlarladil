"use client";

import { upload } from "@vercel/blob/client";

type StagedVideoPurpose = "manual-video" | "automation-video";
type StagedVideo = {
  path: string;
  sourceUrl: string;
  mimeType: "video/mp4" | "video/webm";
};

export async function stageBrowserVideo(blob: Blob, purpose: StagedVideoPurpose, outputId?: string): Promise<StagedVideo> {
  const mimeType: "video/mp4" | "video/webm" = blob.type === "video/mp4" ? "video/mp4" : "video/webm";
  if (!blob.size || blob.size > 100 * 1024 * 1024) throw new Error("video_too_large");
  const path = purpose === "automation-video"
    ? `automation/${outputId}.${mimeType === "video/webm" ? "webm" : "mp4"}`
    : `automation/manual/${crypto.randomUUID()}.${mimeType === "video/webm" ? "webm" : "mp4"}`;
  const result = await upload(path, blob, {
    access: "private",
    contentType: mimeType,
    handleUploadUrl: "/api/twitter-automation/media-stage",
    clientPayload: JSON.stringify({ purpose, outputId }),
    multipart: blob.size > 4.5 * 1024 * 1024,
  }).catch(() => null);
  if (!result?.pathname) throw new Error("media_stage_upload_failed");

  const deliveryResponse = await fetch("/api/twitter-automation/media-stage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "create-delivery-url", path: result.pathname }),
  });
  const delivery = await deliveryResponse.json().catch(() => null) as { sourceUrl?: string } | null;
  if (!deliveryResponse.ok || !delivery?.sourceUrl) throw new Error("media_stage_unavailable");
  return { path: result.pathname, sourceUrl: delivery.sourceUrl, mimeType };
}

type StagedImage = {
  path: string;
  sourceUrl: string;
  mimeType: "image/png";
};

export async function stageBrowserImage(blob: Blob, outputId: string, position = 0): Promise<StagedImage> {
  if (blob.type !== "image/png" || !blob.size || blob.size > 6 * 1024 * 1024) throw new Error("image_too_large");
  const path = `automation/${outputId}${position ? `-${position + 1}` : ""}.png`;
  const result = await upload(path, blob, {
    access: "private",
    contentType: "image/png",
    handleUploadUrl: "/api/twitter-automation/media-stage",
    clientPayload: JSON.stringify({ purpose: "automation-image", outputId, position }),
  }).catch(() => null);
  if (!result?.pathname) throw new Error("media_stage_upload_failed");

  const deliveryResponse = await fetch("/api/twitter-automation/media-stage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "create-delivery-url", path: result.pathname }),
  });
  const delivery = await deliveryResponse.json().catch(() => null) as { sourceUrl?: string } | null;
  if (!deliveryResponse.ok || !delivery?.sourceUrl) throw new Error("media_stage_unavailable");
  return { path: result.pathname, sourceUrl: delivery.sourceUrl, mimeType: "image/png" };
}
