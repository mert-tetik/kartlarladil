import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const POYO_API_URL = "https://api.poyo.ai";
const IMAGE_TASK_TIMEOUT_MS = 300_000;
const IMAGE_TASK_POLL_INTERVAL_MS = 5_000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

const BRAND_REFERENCE_ASSETS = [
  { path: "mascots/mascot1.webp", name: "foxiesdeck-mascot.webp", type: "image/webp" },
  { path: "splash.png", name: "foxiesdeck-wordmark.png", type: "image/png" },
  { path: "logo.webp", name: "foxiesdeck-logo.webp", type: "image/webp" },
] as const;

type PoyoImageSize = "1:1" | "2:3";
type PoyoTaskStatus = "not_started" | "running" | "finished" | "failed";

type PoyoImageTask = {
  status: PoyoTaskStatus;
  imageUrl: string | null;
};

export class PoyoImageError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function getPoyoApiKey() {
  const apiKey = process.env.POYO_API_KEY?.trim();
  if (!apiKey) throw new PoyoImageError("poyo_not_configured");
  return apiKey;
}

async function uploadBase64Asset(base64Data: string, fileName: string, apiKey: string) {
  const response = await fetch(`${POYO_API_URL}/api/common/upload/base64`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      base64_data: base64Data,
      upload_path: "foxiesdeck-image-references",
      file_name: fileName,
    }),
  });
  const payload = await response.json().catch(() => null) as { data?: { file_url?: unknown } } | null;
  if (!response.ok || typeof payload?.data?.file_url !== "string") {
    throw new PoyoImageError("poyo_reference_upload_failed");
  }
  return payload.data.file_url;
}

async function getBrandReferenceUrls(apiKey: string) {
  const requestId = crypto.randomUUID();
  return await Promise.all(BRAND_REFERENCE_ASSETS.map(async (asset) => {
    const data = await readFile(join(process.cwd(), "public", asset.path));
    const dataUrl = `data:${asset.type};base64,${data.toString("base64")}`;
    return await uploadBase64Asset(dataUrl, `${requestId}-${asset.name}`, apiKey);
  }));
}

async function submitImageEdit(prompt: string, size: PoyoImageSize, imageUrls: string[], apiKey: string) {
  const response = await fetch(`${POYO_API_URL}/api/generate/submit`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-2-edit",
      input: {
        prompt,
        image_urls: imageUrls,
        quality: "low",
        size,
        resolution: "1K",
      },
    }),
  });
  const payload = await response.json().catch(() => null) as { data?: { task_id?: unknown } } | null;
  if (!response.ok || typeof payload?.data?.task_id !== "string") {
    throw new PoyoImageError("poyo_image_submission_failed");
  }
  return payload.data.task_id;
}

function isPoyoTaskStatus(value: unknown): value is PoyoTaskStatus {
  return value === "not_started" || value === "running" || value === "finished" || value === "failed";
}

async function getImageTask(taskId: string, apiKey: string): Promise<PoyoImageTask | null> {
  const response = await fetch(`${POYO_API_URL}/api/generate/status/${encodeURIComponent(taskId)}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (response.status === 429) return { status: "running", imageUrl: null };
  if (!response.ok) return null;

  const payload = await response.json().catch(() => null) as {
    data?: { status?: unknown; files?: Array<{ file_url?: unknown; file_type?: unknown }> };
  } | null;
  const task = payload?.data;
  if (!task || !isPoyoTaskStatus(task.status)) return null;
  const image = task.files?.find((file) => typeof file.file_url === "string" && (
    file.file_type === "image" || /\.(?:png|jpe?g|webp)(?:$|[?#])/iu.test(file.file_url)
  ));
  return { status: task.status, imageUrl: typeof image?.file_url === "string" ? image.file_url : null };
}

async function waitForImage(taskId: string, apiKey: string, timeoutMs = IMAGE_TASK_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = await getImageTask(taskId, apiKey);
    if (!task) throw new PoyoImageError("poyo_image_status_failed");
    if (task.status === "failed") throw new PoyoImageError("poyo_image_generation_failed");
    if (task.status === "finished") {
      if (!task.imageUrl) throw new PoyoImageError("poyo_image_missing");
      return task.imageUrl;
    }
    await new Promise((resolve) => setTimeout(resolve, IMAGE_TASK_POLL_INTERVAL_MS));
  }
  throw new PoyoImageError("poyo_image_timeout");
}

function imageMimeType(contentType: string | null, sourceUrl: string) {
  const type = contentType?.split(";", 1)[0]?.toLowerCase();
  if (type === "image/png" || type === "image/jpeg" || type === "image/webp") return type;
  if (/\.png(?:$|[?#])/iu.test(sourceUrl)) return "image/png" as const;
  if (/\.jpe?g(?:$|[?#])/iu.test(sourceUrl)) return "image/jpeg" as const;
  if (/\.webp(?:$|[?#])/iu.test(sourceUrl)) return "image/webp" as const;
  throw new PoyoImageError("poyo_image_format_unsupported");
}

async function downloadImage(sourceUrl: string) {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) throw new PoyoImageError("poyo_image_download_failed");
  const expectedSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(expectedSize) && expectedSize > MAX_IMAGE_BYTES) {
    throw new PoyoImageError("poyo_image_too_large");
  }
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > MAX_IMAGE_BYTES) throw new PoyoImageError("poyo_image_too_large");
  const mimeType = imageMimeType(response.headers.get("content-type"), sourceUrl);
  return { data, mimeType, dataUrl: `data:${mimeType};base64,${data.toString("base64")}` };
}

export async function generatePoyoImageEdit({
  prompt,
  size,
  timeoutMs,
}: {
  prompt: string;
  size: PoyoImageSize;
  /** Internal test seam; production callers use the five-minute default. */
  timeoutMs?: number;
}) {
  const apiKey = getPoyoApiKey();
  const imageUrls = await getBrandReferenceUrls(apiKey);
  const taskId = await submitImageEdit(prompt, size, imageUrls, apiKey);
  return await downloadImage(await waitForImage(taskId, apiKey, timeoutMs));
}
