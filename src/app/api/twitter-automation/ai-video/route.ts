import sharp from "sharp";
import { z } from "zod";
import { isLanguageCode } from "@/data/languages";
import { extractResponseOutputText } from "@/features/ai-practice/ai-practice-openai";
import { hasSocialStudioSession } from "@/features/twitter-automation/social-studio-auth";
import { FOXIESDECK_MASCOT_VOICE } from "@/features/twitter-automation/poyo-speech";
import { generatePoyoImageEdit, PoyoImageError } from "@/features/twitter-automation/poyo-image-generation";
import { generateSocialStudioTextWithFallback, getSocialStudioResponsesErrorCode, getSocialStudioResponsesProviderLabel, SOCIAL_CONTENT_CREATIVE_MODEL } from "@/features/twitter-automation/social-studio-poyo";
import { createSocialStudioDiagnostic } from "@/features/twitter-automation/social-studio-diagnostics";
import { finalizeNativeCaption, getNativeCaptionHashtags } from "@/features/twitter-automation/social-video-titles";
import { resolveSocialStudioVocabularyCard, selectSocialStudioVocabularyTerms, SocialStudioVocabularyError } from "@/features/twitter-automation/social-studio-vocabulary";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LanguageCode, Tier, VocabularyCard } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 720;

const POYO_API_URL = "https://api.poyo.ai";
const VIDEO_MODEL = "kling-avatar-2.0/standard";
const SPEECH_MODEL = "elevenlabs-tts-turbo-2-5";
const SPEECH_WAIT_TIMEOUT_MS = 150_000;
const SPEECH_POLL_INTERVAL_MS = 5_000;
const SOCIAL_STUDIO_AUDIO_BUCKET = "social-studio-audio";
const AVATAR_FRAME_WIDTH = 576;
const AVATAR_FRAME_HEIGHT = 1024;

const requestSchema = z.object({
  language: z.string().refine(isLanguageCode),
  nativeLanguage: z.string().refine(isLanguageCode),
  tier: z.enum(["A1", "A2", "B1", "B2", "C1"]),
});

const ENGLISH_LANGUAGE_NAMES: Record<LanguageCode, string> = {
  tr: "Turkish", en: "English", de: "German", ru: "Russian", fr: "French", es: "Spanish", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", ar: "Arabic", ja: "Japanese", ko: "Korean", "zh-CN": "Chinese",
};

interface VideoPlan {
  framePrompt: string;
  spokenBefore: string;
  spokenAfter: string;
  caption: string;
}

interface PoyoTask {
  status: "not_started" | "running" | "finished" | "failed";
  progress: number;
  videoUrl: string | null;
  audioUrl: string | null;
  errorMessage: string | null;
}

async function formatAvatarFrame(image: Buffer) {
  // PoYo GPT Image 2 produces a low-quality 2:3 source. Convert its centered
  // composition to the 9:16 asset expected by the avatar pipeline.
  const formattedFrame = await sharp(image)
    .resize(AVATAR_FRAME_WIDTH, AVATAR_FRAME_HEIGHT, { fit: "cover", position: "centre" })
    .webp({ quality: 80 })
    .toBuffer();

  return `data:image/webp;base64,${formattedFrame.toString("base64")}`;
}

async function selectCard(language: LanguageCode, nativeLanguage: LanguageCode, tier: Tier) {
  const [term] = await selectSocialStudioVocabularyTerms({ language, nativeLanguage, tier, count: 1, generator: "ai-word-of-the-day-video" });
  return await resolveSocialStudioVocabularyCard(term!, language, nativeLanguage);
}

function extractJsonObject(value: string) {
  const withoutFence = value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? withoutFence.slice(firstBrace, lastBrace + 1) : withoutFence;
}

function parseVideoPlan(value: string): VideoPlan | null {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as Partial<VideoPlan>;
    const framePrompt = typeof parsed.framePrompt === "string" ? parsed.framePrompt.trim() : "";
    const spokenBefore = typeof parsed.spokenBefore === "string" ? parsed.spokenBefore.trim() : "";
    const spokenAfter = typeof parsed.spokenAfter === "string" ? parsed.spokenAfter.trim() : "";
    const caption = typeof parsed.caption === "string" ? parsed.caption.trim() : "";
    if (framePrompt.length < 80 || spokenBefore.length < 8 || spokenAfter.length < 40 || caption.length < 12) return null;

    return {
      framePrompt: framePrompt.slice(0, 5000),
      spokenBefore: spokenBefore.slice(0, 140),
      spokenAfter: spokenAfter.slice(0, 300),
      caption: caption.slice(0, 400),
    };
  } catch {
    return null;
  }
}

async function createVideoPlan(card: VocabularyCard, language: LanguageCode, nativeLanguage: LanguageCode) {
  if (!process.env.POYO_API_KEY?.trim()) return null;

  const instructions = [
    "You are the senior creative director for FoxiesDeck, a playful vocabulary-card app.",
    "Return exactly one JSON object with four string fields: framePrompt, spokenBefore, spokenAfter, caption. Do not add markdown or any text outside JSON.",
    "framePrompt is a detailed English prompt for an avatar-ready vertical social visual. The generated source is center-cropped to 9:16, so keep every critical element inside the central 80% width. Put the featured FoxiesDeck vocabulary card fully readable in the upper third. The supplied mascot reference must appear as a faithful polished 3D version of the same 2D mascot, chest-up in the lower half, facing the camera with its full mouth unobstructed for lip sync. Choose one random but tasteful scene that supports the featured word. Preserve generous negative space and do not use sparkles, grids, fake interface chrome, or unrelated logos.",
    "spokenBefore and spokenAfter are spoken by the fox mascot in the selected native language, not the learning language. The exact featured word is inserted between them later and must not appear in either field. spokenBefore is a very short natural lead-in of 3 to 8 words, ending as if introducing the word. spokenAfter contains a compact explanation in one or two natural sentences, around 16 to 26 words total: lively, warm, lightly funny, and genuinely useful. Include one brief playful image, comparison, or tiny joke that fits the word. Do not use quotation marks, hashtags, stage directions, or English unless English is the selected native language.",
    `caption must be a ready-to-post caption in the selected native language, with a short hook. End with exactly these native-language hashtags: ${getNativeCaptionHashtags(nativeLanguage).join(" ")}. Do not use English hashtags unless English is the selected native language.`,
    "The featured word must be completely random and must not repeat any word used in previous generations, even when this request runs immediately after another one.",
    "Reference image 1 is the official FoxiesDeck fox mascot. Keep its face, ears, tail, orange-and-cream palette, and expression recognisable when making it 3D.",
    "Reference image 2 is the official FoxiesDeck wordmark. Use it only if it improves the composition, and reproduce it faithfully.",
    "Reference image 3 is the official FoxiesDeck logo. Use it only if useful and never replace it with a generic logo.",
  ].join("\n");
  const input = {
    learningLanguage: ENGLISH_LANGUAGE_NAMES[language],
    nativeLanguage: ENGLISH_LANGUAGE_NAMES[nativeLanguage],
    card: {
      term: card.term,
      nativeMeaning: card.translations[nativeLanguage] || card.translation,
      tier: card.tier,
      partOfSpeech: card.partOfSpeech,
      example: card.examples[0]?.sentence ?? card.example,
    },
  };
  const generate = async (repair: boolean) => {
    const { output } = await generateSocialStudioTextWithFallback(
      SOCIAL_CONTENT_CREATIVE_MODEL,
      (client, model) => client.responses.create({
      model,
      instructions: repair ? `${instructions}\nYour previous response was invalid. Return only valid JSON with all four required string fields.` : instructions,
      input: JSON.stringify(input),
      max_output_tokens: 1000,
      reasoning: { effort: "none" },
      store: false,
      text: { format: { type: "text" }, verbosity: "medium" },
      }),
      extractResponseOutputText,
    );
    return parseVideoPlan(output.trim());
  };

  return await generate(false) ?? await generate(true);
}

async function uploadBase64Asset(base64Data: string, fileName: string, apiKey: string) {
  const response = await fetch(`${POYO_API_URL}/api/common/upload/base64`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      base64_data: base64Data,
      upload_path: "foxiesdeck-word-of-the-day",
      file_name: fileName,
    }),
  });
  const payload = await response.json().catch(() => null) as { data?: { file_url?: unknown } } | null;
  return response.ok && typeof payload?.data?.file_url === "string" ? payload.data.file_url : null;
}

async function getPoyoTask(taskId: string, apiKey: string): Promise<PoyoTask | null> {
  const response = await fetch(`${POYO_API_URL}/api/generate/status/${encodeURIComponent(taskId)}`, {
    headers: { authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  // PoYo rate-limits status reads. Treat this as an in-progress task instead of
  // incorrectly failing a healthy generation on a temporary 429 response.
  if (response.status === 429) {
    return { status: "running", progress: 0, videoUrl: null, audioUrl: null, errorMessage: null };
  }
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null) as {
    data?: { status?: unknown; progress?: unknown; error_message?: unknown; files?: Array<{ file_url?: unknown; file_type?: unknown }> };
  } | null;
  const taskData = payload?.data;
  if (!taskData) return null;
  const status = taskData.status;
  if (status !== "not_started" && status !== "running" && status !== "finished" && status !== "failed") return null;

  const video = taskData.files?.find((file) => file.file_type === "video" && typeof file.file_url === "string");
  const audio = taskData.files?.find((file) => file.file_type === "audio" && typeof file.file_url === "string");
  return {
    status,
    progress: typeof taskData.progress === "number" ? taskData.progress : 0,
    videoUrl: typeof video?.file_url === "string" ? video.file_url : null,
    audioUrl: typeof audio?.file_url === "string" ? audio.file_url : null,
    errorMessage: typeof taskData.error_message === "string" ? taskData.error_message : null,
  };
}

async function waitForSpeechAudios(taskIds: readonly string[], apiKey: string) {
  const deadline = Date.now() + SPEECH_WAIT_TIMEOUT_MS;
  const audioByTask = new Map<string, string>();

  while (Date.now() < deadline) {
    for (const taskId of taskIds) {
      if (audioByTask.has(taskId)) continue;

      const task = await getPoyoTask(taskId, apiKey);
      if (!task) return { audioUrls: null, error: "speech_status_failed" as const };
      if (task.status === "failed") return { audioUrls: null, error: "speech_generation_failed" as const };
      if (task.status === "finished" && task.audioUrl) audioByTask.set(taskId, task.audioUrl);
    }

    if (audioByTask.size === taskIds.length) {
      return { audioUrls: taskIds.map((taskId) => audioByTask.get(taskId)!), error: null };
    }

    await new Promise((resolve) => setTimeout(resolve, SPEECH_POLL_INTERVAL_MS));
  }

  return { audioUrls: null, error: "speech_timeout" as const };
}

function getSpeechLanguageCode(language: LanguageCode) {
  return language === "zh-CN" ? "zh" : language;
}

async function submitSpeechTask(text: string, language: LanguageCode, speed: number, apiKey: string) {
  const response = await fetch(`${POYO_API_URL}/api/generate/submit`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: SPEECH_MODEL,
      input: {
        text,
        voice: FOXIESDECK_MASCOT_VOICE,
        language_code: getSpeechLanguageCode(language),
        stability: 0.7,
        similarity_boost: 0.78,
        style: 0.12,
        speed,
        timestamps: false,
        apply_text_normalization: "auto",
      },
    }),
  });
  const payload = await response.json().catch(() => null) as { data?: { task_id?: unknown } } | null;
  return response.ok && typeof payload?.data?.task_id === "string" ? payload.data.task_id : null;
}

async function combineMp3Segments(audioUrls: readonly string[]) {
  const responses = await Promise.all(audioUrls.map((audioUrl) => fetch(audioUrl, { cache: "no-store" })));
  if (responses.some((response) => !response.ok)) return null;

  const segments = await Promise.all(responses.map(async (response) => Buffer.from(await response.arrayBuffer())));
  // Keep one stream of MP3 frames. Repeated ID3 headers between segments can
  // cause third-party video services to reject otherwise valid concatenated audio.
  const combined = Buffer.concat(segments.map((segment, index) => index === 0 ? segment : stripLeadingId3Tag(segment)));
  if (!combined.length || combined.length > 5 * 1024 * 1024) return null;

  return combined;
}

function stripLeadingId3Tag(segment: Buffer) {
  if (segment.length < 10 || segment.subarray(0, 3).toString("ascii") !== "ID3") return segment;

  const flags = segment[5] ?? 0;
  const size = ((segment[6] ?? 0) << 21) | ((segment[7] ?? 0) << 14) | ((segment[8] ?? 0) << 7) | (segment[9] ?? 0);
  const headerLength = 10 + size + (flags & 0x10 ? 10 : 0);
  return headerLength < segment.length ? segment.subarray(headerLength) : segment;
}

async function uploadAudioForAvatar(audio: Buffer) {
  try {
    const supabase = createSupabaseAdminClient();
    const filePath = `avatar-audio/${Date.now()}-${crypto.randomUUID()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from(SOCIAL_STUDIO_AUDIO_BUCKET)
      .upload(filePath, audio, { cacheControl: "900", contentType: "audio/mpeg", upsert: false });
    if (uploadError) return null;

    const { data, error: signedUrlError } = await supabase.storage
      .from(SOCIAL_STUDIO_AUDIO_BUCKET)
      .createSignedUrl(filePath, 15 * 60);
    if (signedUrlError || !data?.signedUrl) return null;

    return data.signedUrl;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ errorCode: "invalid_request" }, { status: 400 });

  const poyoApiKey = process.env.POYO_API_KEY;
  if (!poyoApiKey?.trim()) return Response.json({ errorCode: "poyo_not_configured" }, { status: 503 });

  let card: VocabularyCard;
  try {
    card = await selectCard(parsed.data.language, parsed.data.nativeLanguage, parsed.data.tier);
  } catch (error) {
    const errorCode = error instanceof SocialStudioVocabularyError ? error.code : getSocialStudioResponsesErrorCode(error) ?? "card_generation_failed";
    return Response.json({
      errorCode,
      diagnostic: createSocialStudioDiagnostic({ stage: "Avatar vocabulary selection", provider: getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Terra"), error, fallbackDetail: "The video could not select a fresh vocabulary term." }),
    }, { status: 502 });
  }

  let plan: VideoPlan | null;
  try {
    plan = await createVideoPlan(card, parsed.data.language, parsed.data.nativeLanguage);
  } catch (error) {
    return Response.json({
      errorCode: getSocialStudioResponsesErrorCode(error) ?? "video_plan_failed",
      diagnostic: createSocialStudioDiagnostic({ stage: "Avatar video plan", provider: getSocialStudioResponsesProviderLabel(error, "PoYo Responses / Terra"), error, fallbackDetail: "The avatar script and first-frame plan request failed." }),
    }, { status: 502 });
  }
  if (!plan) return Response.json({
    errorCode: "invalid_video_plan",
    diagnostic: createSocialStudioDiagnostic({ stage: "Avatar video plan validation", provider: "PoYo Responses / Terra", fallbackDetail: "The returned plan was missing a usable frame prompt, narration, or caption." }),
  }, { status: 502 });

  let frameDataUrl: string;
  try {
    const image = await generatePoyoImageEdit({
      prompt: plan.framePrompt,
      size: "2:3",
    });
    frameDataUrl = await formatAvatarFrame(image.data);
  } catch (error) {
    if (error instanceof PoyoImageError) {
      return Response.json({
        errorCode: error.code,
        diagnostic: createSocialStudioDiagnostic({ stage: "Avatar first-frame render", provider: "PoYo Generate / GPT Image", error, fallbackDetail: "The first-frame image task could not be completed." }),
      }, { status: error.code === "poyo_not_configured" ? 503 : 502 });
    }
    return Response.json({
      errorCode: "first_frame_failed",
      diagnostic: createSocialStudioDiagnostic({ stage: "Avatar first-frame render", provider: "PoYo Generate / GPT Image", error, fallbackDetail: "The first-frame image task failed unexpectedly." }),
    }, { status: 502 });
  }

  const frameUrl = await uploadBase64Asset(
    frameDataUrl,
    `foxiesdeck-word-of-the-day-${Date.now()}.webp`,
    poyoApiKey,
  );
  if (!frameUrl) return Response.json({ errorCode: "frame_upload_failed", diagnostic: createSocialStudioDiagnostic({ stage: "Avatar frame upload", provider: "PoYo Storage", fallbackDetail: "PoYo did not return a public URL for the generated first frame." }) }, { status: 502 });

  const [introTaskId, termTaskId, explanationTaskId] = await Promise.all([
    submitSpeechTask(plan.spokenBefore, parsed.data.nativeLanguage, 1.15, poyoApiKey),
    submitSpeechTask(card.term, parsed.data.language, 1, poyoApiKey),
    submitSpeechTask(plan.spokenAfter, parsed.data.nativeLanguage, 1.15, poyoApiKey),
  ]);
  if (!introTaskId || !termTaskId || !explanationTaskId) {
    return Response.json({ errorCode: "speech_submission_failed", diagnostic: createSocialStudioDiagnostic({ stage: "Avatar voice submission", provider: "PoYo Generate / ElevenLabs", fallbackDetail: "PoYo did not accept one or more voice tasks." }) }, { status: 502 });
  }

  const speech = await waitForSpeechAudios([introTaskId, termTaskId, explanationTaskId], poyoApiKey);
  if (!speech.audioUrls) return Response.json({ errorCode: speech.error, diagnostic: createSocialStudioDiagnostic({ stage: "Avatar voice generation", provider: "PoYo Generate / ElevenLabs", fallbackDetail: `Voice task failed: ${speech.error}.` }) }, { status: 502 });

  const combinedSpeech = await combineMp3Segments(speech.audioUrls);
  if (!combinedSpeech) return Response.json({ errorCode: "speech_merge_failed", diagnostic: createSocialStudioDiagnostic({ stage: "Avatar voice merge", fallbackDetail: "Generated voice files could not be downloaded or combined into a valid MP3." }) }, { status: 502 });

  const speechUrl = await uploadAudioForAvatar(combinedSpeech);
  if (!speechUrl) return Response.json({ errorCode: "speech_upload_failed", diagnostic: createSocialStudioDiagnostic({ stage: "Avatar voice staging", provider: "Supabase Storage", fallbackDetail: "The combined narration could not be staged for Kling." }) }, { status: 502 });

  const videoResponse = await fetch(`${POYO_API_URL}/api/generate/submit`, {
    method: "POST",
    headers: { authorization: `Bearer ${poyoApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: VIDEO_MODEL,
      input: {
        image_urls: [frameUrl],
        audio_url: speechUrl,
        prompt: "Use the provided audio exactly. The FoxiesDeck mascot speaks directly to camera with expressive, natural lip sync, gentle head movement, warm eye contact, and subtle paw gestures. Preserve the vertical composition, scene, and all featured card typography exactly. Do not add subtitles, new text, music, or sound effects.",
      },
    }),
  });
  const videoPayload = await videoResponse.json().catch(() => null) as { data?: { task_id?: unknown } } | null;
  const taskId = videoPayload?.data?.task_id;
  if (!videoResponse.ok || typeof taskId !== "string") return Response.json({ errorCode: "avatar_submission_failed", diagnostic: createSocialStudioDiagnostic({ stage: "Kling Avatar submission", provider: "PoYo Generate / Kling", fallbackDetail: `Kling did not accept the avatar task (HTTP ${videoResponse.status}).` }) }, { status: 502 });

  return Response.json({
    taskId,
    firstFrameUrl: frameDataUrl,
    caption: finalizeNativeCaption(plan.caption, parsed.data.nativeLanguage),
    spokenLine: `${plan.spokenBefore} ${card.term} ${plan.spokenAfter}`.replace(/\s+/gu, " ").trim(),
    card: { term: card.term, tier: card.tier },
  });
}

export async function GET(request: Request) {
  if (!hasSocialStudioSession(request.headers.get("cookie"))) {
    return Response.json({ errorCode: "unauthorized" }, { status: 401 });
  }

  const taskId = new URL(request.url).searchParams.get("taskId");
  if (!taskId || !/^[a-zA-Z0-9_-]{8,160}$/u.test(taskId)) {
    return Response.json({ errorCode: "invalid_request" }, { status: 400 });
  }
  const poyoApiKey = process.env.POYO_API_KEY;
  if (!poyoApiKey) return Response.json({ errorCode: "poyo_not_configured" }, { status: 503 });

  const task = await getPoyoTask(taskId, poyoApiKey);
  if (!task) return Response.json({
    errorCode: "video_status_failed",
    diagnostic: createSocialStudioDiagnostic({ stage: "Kling Avatar status check", provider: "PoYo Generate / Kling", fallbackDetail: "PoYo did not return a readable status for the submitted avatar task." }),
  }, { status: 502 });
  return Response.json(task);
}
