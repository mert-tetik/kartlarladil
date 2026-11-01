import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { get, head, put } from "@vercel/blob";

const SOURCE_BUCKETS = [
  "social-studio-assets",
  "social-studio-automation",
  "social-studio-audio",
];
const requestedBucket = process.argv.includes("--bucket") ? process.argv[process.argv.indexOf("--bucket") + 1] : null;
const BUCKETS_TO_MIGRATE = requestedBucket ? SOURCE_BUCKETS.filter((bucket) => bucket === requestedBucket) : SOURCE_BUCKETS;
const BLOB_ACCESS = "private";
const BLOB_CACHE_MAX_AGE = 31_536_000;

function loadEnvFile(text) {
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Z0-9_]+)=(.*)$/u.exec(trimmed);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value.replaceAll("\\n", "\n");
  }
}

async function loadRequestedEnvFile() {
  const index = process.argv.indexOf("--env-file");
  const filePath = index >= 0 ? process.argv[index + 1] : ".env.local";
  if (!filePath) throw new Error("--env-file requires a path");
  try {
    loadEnvFile(await readFile(filePath, "utf8"));
  } catch (error) {
    if (index >= 0) throw error;
  }
}

async function loadTokenFromStdin() {
  if (!process.argv.includes("--token-stdin")) return;
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const token = Buffer.concat(chunks).toString("utf8").trim();
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN_missing");
  process.env.BLOB_READ_WRITE_TOKEN = token;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_missing`);
  return value;
}

function contentTypeFor(pathname, metadata) {
  if (typeof metadata?.mimetype === "string" && metadata.mimetype) return metadata.mimetype;
  const extension = pathname.split(".").pop()?.toLowerCase();
  return extension === "mp4" ? "video/mp4"
    : extension === "webm" ? "video/webm"
      : extension === "mp3" ? "audio/mpeg"
        : extension === "png" ? "image/png"
          : extension === "jpg" || extension === "jpeg" ? "image/jpeg"
            : "application/octet-stream";
}

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function withRetry(label, operation, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw new Error(`${label}:${lastError instanceof Error ? lastError.message : "failed"}`);
}

async function listObjects(storage, prefix = "") {
  const objects = [];
  for (let offset = 0; ; offset += 1_000) {
    const { data, error } = await storage.list(prefix, { limit: 1_000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) objects.push(...await listObjects(storage, path));
      else objects.push({ path, metadata: entry.metadata ?? null, size: entry.metadata?.size ?? null });
    }
    if (!data || data.length < 1_000) break;
  }
  return objects;
}

async function readBlob(pathname) {
  const result = await get(pathname, { access: BLOB_ACCESS, useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error(`blob_read_failed:${pathname}`);
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

async function migrateObject(supabase, bucket, object) {
  const data = await withRetry(`supabase_download_failed:${bucket}/${object.path}`, async () => {
    const result = await supabase.storage.from(bucket).download(object.path);
    if (result.error || !result.data) throw result.error ?? new Error(`supabase_download_failed:${bucket}`);
    return result.data;
  });
  const source = await withRetry(`supabase_read_failed:${bucket}/${object.path}`, () => data.arrayBuffer()).then((value) => Buffer.from(value));
  const sourceHash = digest(source);

  await withRetry(`blob_upload_failed:${object.path}`, () => put(object.path, source, {
    access: BLOB_ACCESS,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: contentTypeFor(object.path, object.metadata),
    cacheControlMaxAge: BLOB_CACHE_MAX_AGE,
  }));

  const copiedMetadata = await withRetry(`blob_head_failed:${object.path}`, () => head(object.path));
  const result = { sourceBytes: source.length, verifiedBytes: copiedMetadata.size, verifiedCount: copiedMetadata.size === source.length ? 1 : 0, hashCompared: 0, hashMismatches: copiedMetadata.size === source.length ? 0 : 1 };
  // Large objects are verified by exact Blob HEAD size; small objects also
  // receive a byte-for-byte SHA-256 comparison without another large download.
  if (source.length <= 8 * 1024 * 1024) {
    const copied = await withRetry(`blob_read_failed:${object.path}`, () => readBlob(object.path));
    result.hashCompared = 1;
    if (digest(copied) !== sourceHash) result.hashMismatches += 1;
  }
  return result;
}

async function migrateBucket(supabase, bucket, seen) {
  const objects = await listObjects(supabase.storage.from(bucket));
  const summary = { bucket, sourceCount: objects.length, sourceBytes: 0, verifiedCount: 0, verifiedBytes: 0, hashCompared: 0, hashMismatches: 0 };
  for (const object of objects) {
    if (seen.has(object.path)) throw new Error(`duplicate_blob_path:${object.path}`);
    seen.add(object.path);
  }

  // Keep large dialogue videos sequential to avoid holding multiple full
  // source buffers in memory. Automation renders are smaller and can use two
  // lanes without changing pathname or verification semantics.
  const concurrency = bucket === "social-studio-automation" ? 2 : 1;
  for (let offset = 0; offset < objects.length; offset += concurrency) {
    const results = await Promise.all(objects.slice(offset, offset + concurrency).map((object) => migrateObject(supabase, bucket, object)));
    for (const result of results) {
      summary.sourceBytes += result.sourceBytes;
      summary.verifiedBytes += result.verifiedBytes;
      summary.verifiedCount += result.verifiedCount;
      summary.hashCompared += result.hashCompared;
      summary.hashMismatches += result.hashMismatches;
    }
  }
  return summary;
}

await loadRequestedEnvFile();
await loadTokenFromStdin();
const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
requireEnv("BLOB_READ_WRITE_TOKEN");

const seen = new Set();
const summaries = [];
for (const bucket of BUCKETS_TO_MIGRATE) summaries.push(await migrateBucket(supabase, bucket, seen));

const total = summaries.reduce((acc, summary) => ({
  sourceCount: acc.sourceCount + summary.sourceCount,
  sourceBytes: acc.sourceBytes + summary.sourceBytes,
  verifiedCount: acc.verifiedCount + summary.verifiedCount,
  verifiedBytes: acc.verifiedBytes + summary.verifiedBytes,
  hashCompared: acc.hashCompared + summary.hashCompared,
  hashMismatches: acc.hashMismatches + summary.hashMismatches,
}), { sourceCount: 0, sourceBytes: 0, verifiedCount: 0, verifiedBytes: 0, hashCompared: 0, hashMismatches: 0 });

for (const summary of summaries) console.log(JSON.stringify(summary));
console.log(JSON.stringify({ total, destination: "vercel-blob:private:foxiesdeck-social-studio", oldSupabaseCopies: "retained" }));
if (total.verifiedCount !== total.sourceCount || total.sourceBytes !== total.verifiedBytes || total.hashMismatches !== 0) process.exitCode = 2;
