import "server-only";

import type { LanguageCode } from "@/types/domain";

const POYO_API_URL = "https://api.poyo.ai";
const POYO_SPEECH_MODEL = "elevenlabs-tts-turbo-2-5";
/** The custom ElevenLabs voice used by FoxiesDeck's primary mascot. */
export const FOXIESDECK_MASCOT_VOICE = "d8WcCpplp8meHt10UhL8";
const SPEECH_WAIT_TIMEOUT_MS = 150_000;
const SPEECH_POLL_INTERVAL_MS = 5_000;
const MAX_SPEECH_BYTES = 2 * 1024 * 1024;

export type PoyoSpeechSegment = {
  text: string;
  language: LanguageCode;
  speed?: number;
  voice?: string;
};

export class PoyoSpeechError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function getPoyoApiKey() {
  const apiKey = process.env.POYO_API_KEY?.trim();
  if (!apiKey) throw new PoyoSpeechError("poyo_not_configured");
  return apiKey;
}

function speechLanguageCode(language: LanguageCode) {
  return language === "zh-CN" ? "zh" : language;
}

async function submitSpeechTask(segment: PoyoSpeechSegment, apiKey: string) {
  const response = await fetch(`${POYO_API_URL}/api/generate/submit`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: POYO_SPEECH_MODEL,
      input: {
        text: segment.text,
        voice: segment.voice ?? FOXIESDECK_MASCOT_VOICE,
        language_code: speechLanguageCode(segment.language),
        stability: 0.7,
        similarity_boost: 0.78,
        style: 0.12,
        speed: segment.speed ?? 1,
        timestamps: false,
        apply_text_normalization: "auto",
      },
    }),
  });
  const payload = await response.json().catch(() => null) as { data?: { task_id?: unknown } } | null;
  if (!response.ok || typeof payload?.data?.task_id !== "string") throw new PoyoSpeechError("speech_submission_failed");
  return payload.data.task_id;
}

async function getSpeechTask(taskId: string, apiKey: string) {
  const response = await fetch(`${POYO_API_URL}/api/generate/status/${encodeURIComponent(taskId)}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  if (response.status === 429) return { status: "running" as const, audioUrl: null };
  if (!response.ok) throw new PoyoSpeechError("speech_status_failed");
  const payload = await response.json().catch(() => null) as {
    data?: { status?: unknown; files?: Array<{ file_type?: unknown; file_url?: unknown }> };
  } | null;
  const status = payload?.data?.status;
  if (status !== "not_started" && status !== "running" && status !== "finished" && status !== "failed") {
    throw new PoyoSpeechError("speech_status_failed");
  }
  const audio = payload?.data?.files?.find((file) => file.file_type === "audio" && typeof file.file_url === "string");
  return { status, audioUrl: typeof audio?.file_url === "string" ? audio.file_url : null };
}

async function downloadSpeech(audioUrl: string) {
  const response = await fetch(audioUrl, { cache: "no-store" });
  if (!response.ok) throw new PoyoSpeechError("speech_download_failed");
  const expectedSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(expectedSize) && expectedSize > MAX_SPEECH_BYTES) throw new PoyoSpeechError("speech_too_large");
  const data = Buffer.from(await response.arrayBuffer());
  if (!data.length || data.length > MAX_SPEECH_BYTES) throw new PoyoSpeechError("speech_too_large");
  return `data:audio/mpeg;base64,${data.toString("base64")}`;
}

/** Generate short spoken segments with the same PoYo ElevenLabs model as avatar video. */
export async function generatePoyoSpeechDataUrls(segments: readonly PoyoSpeechSegment[]) {
  // Longer browser-rendered explainers can contain several short scenes. Keep
  // this bounded so one request cannot fan out without limit, while allowing
  // the three-phase Confused Words format (24 fragments).
  if (!segments.length || segments.length > 30 || segments.some((segment) => !segment.text.trim() || segment.text.length > 400)) {
    throw new PoyoSpeechError("invalid_speech_segments");
  }
  const apiKey = getPoyoApiKey();
  const taskIds = await Promise.all(segments.map((segment) => submitSpeechTask(segment, apiKey)));
  const pending = new Set(taskIds);
  const urls = new Map<string, string>();
  const deadline = Date.now() + SPEECH_WAIT_TIMEOUT_MS;

  while (pending.size && Date.now() < deadline) {
    await Promise.all([...pending].map(async (taskId) => {
      const task = await getSpeechTask(taskId, apiKey);
      if (task.status === "failed") throw new PoyoSpeechError("speech_generation_failed");
      if (task.status === "finished" && task.audioUrl) {
        urls.set(taskId, task.audioUrl);
        pending.delete(taskId);
      }
    }));
    if (pending.size) await new Promise((resolve) => setTimeout(resolve, SPEECH_POLL_INTERVAL_MS));
  }
  if (pending.size) throw new PoyoSpeechError("speech_timeout");
  return await Promise.all(taskIds.map((taskId) => downloadSpeech(urls.get(taskId)!)));
}
