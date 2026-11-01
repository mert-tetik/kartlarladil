import "server-only";

import { del, get, head, issueSignedToken, list, presignUrl, put } from "@vercel/blob";
type PutBody = Parameters<typeof put>[1];

export const SOCIAL_STUDIO_BLOB_ACCESS = "private" as const;
export const SOCIAL_STUDIO_SIGNED_URL_SECONDS = 15 * 60;
export const SOCIAL_STUDIO_EXTERNAL_URL_SECONDS = 2 * 60 * 60;

const MAX_PATHNAME_LENGTH = 512;

function assertBlobPathname(pathname: string) {
  if (
    !pathname
    || pathname.length > MAX_PATHNAME_LENGTH
    || pathname.startsWith("/")
    || pathname.includes("\\")
    || pathname.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("invalid_social_studio_media_path");
  }
}

export async function putSocialStudioBlob(pathname: string, body: PutBody, contentType: string) {
  assertBlobPathname(pathname);
  return await put(pathname, body, {
    access: SOCIAL_STUDIO_BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    cacheControlMaxAge: 31536000,
  });
}

export async function getSocialStudioBlob(pathname: string, options?: { useCache?: boolean }) {
  assertBlobPathname(pathname);
  return await get(pathname, {
    access: SOCIAL_STUDIO_BLOB_ACCESS,
    ...(options?.useCache === undefined ? {} : { useCache: options.useCache }),
  });
}

export async function readSocialStudioBlob(pathname: string) {
  const result = await getSocialStudioBlob(pathname);
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return {
    body: Buffer.from(await new Response(result.stream).arrayBuffer()),
    contentType: result.blob.contentType ?? "application/octet-stream",
    size: result.blob.size,
    etag: result.blob.etag,
  };
}

export async function headSocialStudioBlob(pathname: string) {
  assertBlobPathname(pathname);
  try {
    return await head(pathname);
  } catch {
    return null;
  }
}

export async function listSocialStudioBlobs(options?: { prefix?: string; limit?: number }) {
  const blobs = [] as Awaited<ReturnType<typeof list>>["blobs"];
  let cursor: string | undefined;
  do {
    const page = await list({
      ...(options?.prefix ? { prefix: options.prefix } : {}),
      ...(options?.limit ? { limit: Math.min(options.limit - blobs.length, 1_000) } : {}),
      ...(cursor ? { cursor } : {}),
    });
    blobs.push(...page.blobs);
    if (options?.limit && blobs.length >= options.limit) break;
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function listSocialStudioBlobPathnames(options?: { prefix?: string; limit?: number }) {
  return (await listSocialStudioBlobs(options)).map((blob) => blob.pathname);
}

export async function deleteSocialStudioBlobs(pathnames: string | string[]) {
  const values = Array.isArray(pathnames) ? pathnames : [pathnames];
  values.forEach(assertBlobPathname);
  if (values.length) await del(values);
}

export async function createSocialStudioBlobSignedUrl(pathname: string, seconds = SOCIAL_STUDIO_SIGNED_URL_SECONDS) {
  assertBlobPathname(pathname);
  const validUntil = Date.now() + Math.max(60, Math.min(seconds, 7 * 24 * 60 * 60)) * 1000;
  const token = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname,
    access: SOCIAL_STUDIO_BLOB_ACCESS,
    validUntil,
  });
  return presignedUrl;
}
