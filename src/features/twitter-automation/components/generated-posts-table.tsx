"use client";

import { CalendarClock, Check, CircleAlert, ImageIcon, LoaderCircle, MessageSquareText, RefreshCw, Trash2, Video, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { estimateRemainingGenerationSeconds, formatEstimatedDuration } from "@/features/twitter-automation/automation-generation-estimates";
import { aiGenerationBoundaryIndex, prioritizeAutomationGenerations } from "@/features/twitter-automation/automation-generation-priority";
import { stageBrowserImage, stageBrowserVideo } from "@/features/twitter-automation/browser-media-stage";
import { BrowserImageRenderError, browserImageFailureCode, retryBrowserImageOperation } from "@/features/twitter-automation/browser-image-retry";
import { BROWSER_VIDEO_PLAN_TIMEOUT_MS, BROWSER_VIDEO_RENDER_STALL_TIMEOUT_MS, browserVideoFailureCode, browserVideoRetryDelayMs, shouldRetryBrowserVideo, shouldRetryBrowserVideoFailure } from "@/features/twitter-automation/browser-video-retry";
import { getOrCreateBrowserVideoPlan, type BrowserVideoPlan } from "@/features/twitter-automation/browser-video-plan";
import { resolveBrowserMusicVideoSourceUrl } from "@/features/twitter-automation/browser-video-source";
import { AutomationBrowserImageRenderer, type AutomationBrowserImageOutput } from "@/features/twitter-automation/components/automation-browser-image-renderer";
import { AutomationGenerationStatusSummary } from "@/features/twitter-automation/components/automation-generation-status-summary";
import { canRenderConfusedWordsDeterministically, renderConfusedWordsVideo } from "@/features/twitter-automation/confused-words-video-renderer";
import { canRenderDialogueDeterministically, renderDialogueVideo } from "@/features/twitter-automation/dialogue-video-renderer";
import { canRenderMusicVideoDeterministically, closeAutomationMusicVideoAudioSession, createOfflineMusicVideoAudioContext, isAutomationMusicVideoAudioContext, prepareMusicVideoAudio, releaseMusicVideoAudioContext, renderMusicVideo } from "@/features/twitter-automation/music-video-renderer";
import { canRenderOriginalMascotDeterministically, renderOriginalMascotLearningVideo } from "@/features/twitter-automation/original-mascot-learning-video-renderer";
import { automationScopeSearchParams, type AutomationScope } from "@/features/twitter-automation/automation-scope";
import { AUTOMATION_RETRY_DELAYS_MS } from "@/features/twitter-automation/automation-resilience";
import { isFailedAutomationOutput, isSkippedAutomationOutput, isSuccessfulAutomationOutput } from "@/features/twitter-automation/automation-output-status";
import { UPLOAD_POST_REQUEST_RECHECK_DELAY_MS, UPLOAD_POST_REQUEST_UNCONFIRMED_CODE } from "@/features/twitter-automation/upload-post-schedule-constants";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";

type AutomationOutputStatus = "queued" | "processing" | "generating_video" | "awaiting_browser_image" | "awaiting_browser_video" | "ready_to_schedule" | "scheduled" | "failed" | "skipped";

type AutomationOutput = {
  id: string;
  day_offset: number;
  group_name: string;
  content_type: string;
  generator: string;
  language: LanguageCode;
  native_language: LanguageCode;
  tier: "A1" | "A2" | "B1" | "B2" | "C1" | "random";
  scheduled_at: string;
  status: AutomationOutputStatus;
  generation_key?: string | null;
  caption: string | null;
  mediaUrl: string | null;
  mediaUrls?: string[];
  media_type: "image" | "video" | null;
  schedule_status?: "pending" | "processing" | "partially_scheduled" | "failed" | "scheduled";
  schedule_error_code?: string | null;
  schedule_error_detail?: string | null;
  schedule_attempt_count?: number;
  schedule_attempted_at?: string | null;
  schedule_completed_at?: string | null;
  bucketStatus?: "stored" | "missing" | "database" | "not_checked" | "unavailable";
  error_code: string | null;
  last_error_detail?: string | null;
  last_provider?: "poyo" | "openai" | null;
  last_provider_status?: number | null;
  last_provider_attempt_count?: number | null;
  last_provider_request_id?: string | null;
  updated_at?: string;
  next_attempt_at?: string;
  attempt_count?: number;
  quality_status?: "pending" | "passed" | "failed";
  quality_error?: string | null;
  render_plan?: unknown;
  run?: {
    schedule_date?: string;
    generation_stopped_at?: string | null;
    finished_by_user_at?: string | null;
  } | null;
};

type LoadState = "loading" | "ready" | "error";
type ModeDurationProfiles = Record<string, number>;

const FLOW_REFRESH_ERROR_MESSAGE = "İçerik üretim akışı yenilenemedi.";
const AUTO_RESUME_COOLDOWN_MS = 30_000;
const MAX_AUTOMATIC_RENDER_RECOVERY_ATTEMPTS = AUTOMATION_RETRY_DELAYS_MS.length;
const STALE_PROCESSING_MS = 3 * 60_000;
// Creative-plan recovery is intentionally serial. Retrying several provider
// failures in parallel tends to create another rate-limit/error wave.
const RECOVERY_RETRY_CONCURRENCY = 1;

const BROWSER_IMAGE_GENERATORS = new Set([
  "word-of-the-day",
  "word-of-the-day-poster",
  "self-mini-quiz",
  "self-false-friends",
  "self-daily-challenge",
  "self-vocabulary-progression",
  "self-example-sentences",
  "vocabulary-carousel",
  "tier-progression-carousel",
]);

const GENERATOR_LABELS: Record<string, string> = {
  "ai-word-of-the-day": "AI Word of the Day görseli",
  "ai-mini-quiz": "AI Mini Quiz görseli",
  "ai-false-friends": "AI False Friends görseli",
  "ai-daily-challenge": "AI Daily Challenge görseli",
  "ai-vocabulary-progression": "AI Beginner to Advanced görseli",
  "ai-example-sentences": "AI Example Sentences görseli",
  "word-of-the-day": "Word of the Day görseli",
  "word-of-the-day-poster": "Word of the Day posteri",
  "vocabulary-carousel": "Vocabulary Carousel",
  "tier-progression-carousel": "A1 to C1 Carousel",
  "self-mini-quiz": "Mini Quiz (Self) görseli",
  "self-false-friends": "False Friends (Self) görseli",
  "self-daily-challenge": "Daily Challenge (Self) görseli",
  "self-vocabulary-progression": "Beginner to Advanced (Self) görseli",
  "self-example-sentences": "Example Sentences (Self) görseli",
  "ai-word-of-the-day-video": "Word of the Day videosu",
  "confused-words-video": "Confused Words videosu",
  "marketing-dialogue-video": "FoxiesDeck diyalog videosu",
  "learning-dialogue-video": "Öğrenme diyalog videosu",
  "tier-progression-video": "A1 to C1 öğrenme videosu",
  "vocabulary-quiz-video": "Kelime quiz videosu",
  "sentence-check-video": "Cümle kontrol videosu",
  "sentence-translation-video": "Cümle çeviri videosu",
};

function formatScheduledAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(date);
}

function getOutputLabel(output: Pick<AutomationOutput, "generator">) {
  if (GENERATOR_LABELS[output.generator]) return GENERATOR_LABELS[output.generator];
  return output.generator.replace(/^music-/u, "Müzikli ").replaceAll("-", " ");
}

function isBrowserRenderedImage(output: AutomationOutput): output is AutomationOutput & AutomationBrowserImageOutput {
  const sourceGenerator = output.generator.startsWith("music-") ? output.generator.slice("music-".length) : output.generator;
  return (output.status === "awaiting_browser_image" || output.status === "awaiting_browser_video") && output.media_type === null && output.tier !== "random" && BROWSER_IMAGE_GENERATORS.has(sourceGenerator);
}

function isAttemptDue(output: Pick<AutomationOutput, "next_attempt_at">, now: number) {
  if (!output.next_attempt_at) return true;
  const timestamp = new Date(output.next_attempt_at).getTime();
  return !Number.isFinite(timestamp) || timestamp <= now;
}

function parseModeDurationProfiles(value: unknown): ModeDurationProfiles {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, durationMs]) => typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs > 0));
}

function isGenerationComplete(output: AutomationOutput) {
  return isSuccessfulAutomationOutput(output);
}

function isOutputSettled(output: AutomationOutput) {
  return isGenerationComplete(output) || isFailedAutomationOutput(output) || isSkippedAutomationOutput(output);
}

function isReadyForSchedule(output: AutomationOutput) {
  return output.status === "ready_to_schedule";
}

function needsGeneration(output: AutomationOutput) {
  return !isOutputSettled(output);
}

function formatRunDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(new Date(`${value}T12:00:00+03:00`));
}

function pendingGenerationMessage(output: AutomationOutput, isInterruptedReview: boolean) {
  if (isInterruptedReview) return FLOW_REFRESH_ERROR_MESSAGE;
  if (output.status === "queued") return "Kuyrukta: son sağlam aşamadan üretime yeniden alınacak.";
  if (output.status === "awaiting_browser_image") return output.render_plan
    ? "Görsel planı hazır: browser PNG renderı bekleniyor."
    : "Görsel planı hazırlanıp browser renderına geçilecek.";
  if (output.status === "awaiting_browser_video") return output.media_type === "image" && output.mediaUrl
    ? "Görsel kaynak hazır: video renderı bekleniyor."
    : "Video planı hazırlanıp browser renderına geçilecek.";
  if (output.status === "generating_video") return "Video sağlayıcısının sonucu bekleniyor.";
  return "İçerik güvenli şekilde işleniyor; renderer heartbeat bekleniyor.";
}

function isStaleProcessingOutput(output: AutomationOutput, now: number) {
  if (output.status !== "processing" || !output.updated_at) return false;
  const updatedAt = new Date(output.updated_at).getTime();
  return Number.isFinite(updatedAt) && now - updatedAt >= STALE_PROCESSING_MS;
}

function abortableBrowserVideoTask<T>(task: Promise<T>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(new Error("browser_video_render_timeout"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(new Error("browser_video_render_timeout"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void task.then((value) => {
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    }, (error: unknown) => {
      signal.removeEventListener("abort", onAbort);
      reject(error);
    });
  });
}

async function canUseOfflineAudioForBrowserVideo(plan: BrowserVideoPlan, signal: AbortSignal) {
  try {
    if (plan.kind === "confused") return await canRenderConfusedWordsDeterministically(signal);
    if (plan.kind === "dialogue") return await abortableBrowserVideoTask(canRenderDialogueDeterministically(), signal);
    if (plan.kind === "original") return await canRenderOriginalMascotDeterministically(signal);
    // Social image sources are at most this 9:16 raster. A successful probe
    // means the actual, equal-or-smaller source can use WebCodecs as well.
    return await abortableBrowserVideoTask(canRenderMusicVideoDeterministically(1080, 1920), signal);
  } catch {
    if (signal.aborted) throw new Error("browser_video_render_timeout");
    return false;
  }
}

async function renderBrowserVideoPlan(output: AutomationOutput, plan: BrowserVideoPlan, audioContext: BaseAudioContext, signal: AbortSignal, onProgress: (progress: number) => void) {
  if (plan.kind === "confused") {
    return await renderConfusedWordsVideo({
      audioContext,
      signal,
      onProgress,
      phases: plan.phases,
      scenes: plan.scenes,
    });
  }
  if (plan.kind === "dialogue") {
    return await abortableBrowserVideoTask(renderDialogueVideo({
      audioContext,
      backgroundVideoUrl: plan.backgroundVideoUrl,
      backgroundVideoPath: plan.backgroundVideoPath,
      firstCharacter: plan.firstCharacter,
      secondCharacter: plan.secondCharacter,
      scenes: plan.scenes,
    }), signal);
  }
  if (plan.kind === "original") {
    return await renderOriginalMascotLearningVideo({
      audioContext,
      signal,
      onProgress,
      scenes: plan.scenes,
      language: output.language,
      nativeLanguage: output.native_language,
    });
  }
  if (!output.mediaUrl) throw new Error("browser_video_source_unavailable");
  return await abortableBrowserVideoTask(renderMusicVideo({ audioContext, imageUrl: output.mediaUrl, musicUrl: plan.musicUrl }), signal);
}

async function renderPreparedBrowserVideo(output: AutomationOutput, plan: BrowserVideoPlan, signal: AbortSignal, onProgress: (progress: number) => void) {
  let audioContext: BaseAudioContext | null = null;
  try {
    const useOfflineAudio = await canUseOfflineAudioForBrowserVideo(plan, signal);
    try {
      audioContext = useOfflineAudio
        ? createOfflineMusicVideoAudioContext()
        : await prepareMusicVideoAudio(signal, { reuseAutomationSession: true });
    } catch (error) {
      throw new Error(browserVideoFailureCode(error, "browser_video_audio_prepare_failed"));
    }

    let blob: Blob;
    try {
      onProgress(0);
      blob = await renderBrowserVideoPlan(output, plan, audioContext, signal, onProgress);
    } catch (error) {
      if (useOfflineAudio && browserVideoFailureCode(error) === "browser_video_realtime_audio_required") {
        await releaseMusicVideoAudioContext(audioContext);
        try {
          audioContext = await prepareMusicVideoAudio(signal, { reuseAutomationSession: true });
        } catch (fallbackError) {
          throw new Error(browserVideoFailureCode(fallbackError, "browser_video_audio_prepare_failed"));
        }
        blob = await renderBrowserVideoPlan(output, plan, audioContext, signal, onProgress);
      } else {
        throw new Error(browserVideoFailureCode(error, "browser_video_encode_failed"));
      }
    }

    return blob;
  } finally {
    if (!isAutomationMusicVideoAudioContext(audioContext)) await releaseMusicVideoAudioContext(audioContext);
  }
}

function generationStatusText(output: AutomationOutput, isProcessing: boolean) {
  if (isProcessing || output.status === "processing") return `${getOutputLabel(output)} üretiliyor`;
  if (output.status === "generating_video") return `${getOutputLabel(output)} renderlanıyor`;
  if (isBrowserRenderedImage(output) || output.status === "awaiting_browser_image") return `${getOutputLabel(output)} Studio tasarımıyla renderlanıyor`;
  if (output.status === "awaiting_browser_video") return `${getOutputLabel(output)} için ses ekleniyor`;
  if (output.status === "ready_to_schedule") return `${getOutputLabel(output)} hazır`;
  if (output.status === "scheduled") return `${getOutputLabel(output)} schedule edildi`;
  if (output.status === "failed") return `${getOutputLabel(output)} üretilemedi`;
  return `${getOutputLabel(output)} üretim sırasını bekliyor`;
}

function formatProviderFailureDetail(output: Pick<AutomationOutput, "last_error_detail" | "last_provider" | "last_provider_status" | "last_provider_attempt_count" | "last_provider_request_id">) {
  const context = [
    output.last_provider === "openai" ? "OpenAI" : output.last_provider === "poyo" ? "PoYo" : null,
    output.last_provider_status ? `HTTP ${output.last_provider_status}` : null,
    output.last_provider_attempt_count ? `${output.last_provider_attempt_count}. deneme` : null,
    output.last_provider_request_id ? `İstek: ${output.last_provider_request_id}` : null,
  ].filter((value): value is string => Boolean(value));
  return [context.join(" · "), output.last_error_detail ?? ""].filter(Boolean).join(" — ");
}

function MediaStatusHint({ errorCode, errorDetail, pendingMessage }: { errorCode: string | null; errorDetail?: string | null; pendingMessage?: string }) {
  const isPending = !errorCode && Boolean(pendingMessage);
  if (!errorCode && !isPending) return null;

  const message = errorCode ?? pendingMessage!;

  return <div className="group absolute right-2 top-2 z-20">
    <button aria-label={isPending ? "İçerik durumu ayrıntısını göster" : "Üretim hata ayrıntısını göster"} className={cn("grid size-7 place-items-center rounded border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2", isPending ? "border-[#f1c75b]/60 bg-[#312816]/95 text-[#f1c75b] hover:bg-[#40351e] focus-visible:outline-[#f1c75b]" : "border-[#ffb9c1]/55 bg-[#2c1917]/95 text-[#ffb9c1] hover:bg-[#3b211e] focus-visible:outline-[#ffb9c1]")} type="button">
      <CircleAlert className="size-4" aria-hidden="true" />
    </button>
    <div className={cn("pointer-events-none absolute right-0 top-full mt-2 w-64 rounded border p-2 text-left text-[11px] leading-4 opacity-0 shadow-sm transition-opacity duration-150 delay-500 group-hover:opacity-100 group-focus-within:opacity-100 group-focus-within:delay-0", isPending ? "border-[#f1c75b]/40 bg-[#292214] text-[#ffeaac]" : "border-[#ffb9c1]/35 bg-[#211413] text-[#ffd9de]")} role="tooltip">
      <p className="font-semibold">{isPending ? "Durum beklemede" : "Üretim hatası"}</p>
      <p className={cn("mt-1 break-words", isPending ? "text-[#f1d77c]" : "text-[#ffb9c1]")}>{message}</p>
      {!isPending && errorDetail ? <p className="mt-1 break-words text-[#e7c8cc]">{errorDetail}</p> : null}
    </div>
  </div>;
}

function bucketStatusLabel(output: Pick<AutomationOutput, "content_type" | "bucketStatus">) {
  if (output.content_type === "text") return { label: "Database'e kaydedildi", className: "text-[#2563eb]" };
  if (output.bucketStatus === "stored") return { label: "Storage'a kaydedildi", className: "text-[#168b51]" };
  if (output.bucketStatus === "missing") return { label: "Storage kaydı eksik", className: "text-[#c0262d]" };
  if (output.bucketStatus === "unavailable") return { label: "Storage kontrol edilemedi", className: "text-[#a16207]" };
  return { label: "Storage kontrolü bekleniyor", className: "text-[#64748b]" };
}

function ResumeAutomationControl({ cooldownSeconds, disabled, onCancelCooldown, onResume }: {
  cooldownSeconds: number | null;
  disabled: boolean;
  onCancelCooldown: () => void;
  onResume: () => void;
}) {
  const cooldownActive = cooldownSeconds !== null;
  return <div className="flex items-center gap-1.5"><Button className="h-9 bg-white px-3 text-xs text-[#2c63e1] hover:bg-white/90" disabled={disabled || cooldownActive} onClick={onResume} type="button"><RefreshCw className="size-3.5" />{cooldownActive ? `Devam etmeye çalış (${cooldownSeconds} sn)` : "Devam etmeye çalış"}</Button>{cooldownActive ? <Button aria-label="Otomatik devam denemesini iptal et" className="size-9 border border-white/15 bg-white/[0.06] p-0 text-white hover:bg-white/[0.12]" onClick={onCancelCooldown} title="Otomatik devam denemesini iptal et" type="button"><X className="size-3.5" /></Button> : null}</div>;
}

export function GeneratedPostsTable({ runId, onClose, scope = "production" }: { runId: string; onClose: () => void; scope?: AutomationScope }) {
  const isTestAutomation = scope === "test";
  const scopeSearchParams = automationScopeSearchParams(scope);
  const [outputs, setOutputs] = useState<AutomationOutput[]>([]);
  const [modeDurationProfiles, setModeDurationProfiles] = useState<ModeDurationProfiles>({});
  const [state, setState] = useState<LoadState>("loading");
  const [processingOutputId, setProcessingOutputId] = useState<string | null>(null);
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(null);
  const [isSchedulingAll, setIsSchedulingAll] = useState(false);
  const [isStoppingGeneration, setIsStoppingGeneration] = useState(false);
  const [isFinishingRun, setIsFinishingRun] = useState(false);
  const [isGenerationStoppedLocally, setIsGenerationStoppedLocally] = useState(false);
  const [isRunFinishedLocally, setIsRunFinishedLocally] = useState(false);
  const [isRefreshingGeneratedMedia, setIsRefreshingGeneratedMedia] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [isInterruptedReview, setIsInterruptedReview] = useState(false);
  const [retryingOutputId, setRetryingOutputId] = useState<string | null>(null);
  const [deletingOutputId, setDeletingOutputId] = useState<string | null>(null);
  const [browserVideoRetryToken, setBrowserVideoRetryToken] = useState(0);
  const [resumeCooldownEndsAt, setResumeCooldownEndsAt] = useState<number | null>(null);
  const [isResumeCooldownCancelled, setIsResumeCooldownCancelled] = useState(false);
  const [renderRecoveryAttempt, setRenderRecoveryAttempt] = useState(0);
  const [renderRecoveryEndsAt, setRenderRecoveryEndsAt] = useState<number | null>(null);
  const [isRecoveringFailedOutputs, setIsRecoveringFailedOutputs] = useState(false);
  const autoStartedBrowserVideoIds = useRef(new Set<string>());
  const automaticResumeInFlight = useRef(false);
  const browserVideoAttempts = useRef(new Map<string, number>());
  const browserVideoPlans = useRef(new Map<string, BrowserVideoPlan>());
  const browserVideoRetryTimers = useRef(new Set<number>());
  const resultMediaLoadedForRun = useRef<string | null>(null);
  const bucketStatusByOutputId = useRef(new Map<string, AutomationOutput["bucketStatus"]>());

  const startResumeCooldown = useCallback(() => {
    const startedAt = Date.now();
    setNow(startedAt);
    setResumeCooldownEndsAt(startedAt + AUTO_RESUME_COOLDOWN_MS);
  }, []);

  const load = useCallback(async (showLoading = false, includeMedia = false): Promise<AutomationOutput[] | null> => {
    if (!includeMedia) resultMediaLoadedForRun.current = null;
    if (showLoading) setState("loading");
    try {
      const response = await fetch(`/api/twitter-automation/automation-runs?runId=${encodeURIComponent(runId)}${scopeSearchParams ? "&scope=test" : ""}${includeMedia ? "&includeMedia=1" : ""}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { outputs?: AutomationOutput[]; durationProfiles?: unknown; errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_runs_unavailable");
      const nextOutputs = Array.isArray(payload?.outputs) ? payload.outputs : [];
      const hydratedOutputs = nextOutputs.map((output) => {
        if (includeMedia && output.bucketStatus) {
          bucketStatusByOutputId.current.set(output.id, output.bucketStatus);
        }
        const knownBucketStatus = bucketStatusByOutputId.current.get(output.id);
        return !includeMedia && knownBucketStatus
          ? { ...output, bucketStatus: knownBucketStatus }
          : output;
      });
      automaticResumeInFlight.current = false;
      setResumeCooldownEndsAt(null);
      setIsResumeCooldownCancelled(false);
      setOutputs(hydratedOutputs);
      setModeDurationProfiles(parseModeDurationProfiles(payload?.durationProfiles));
      setState("ready");
      return nextOutputs;
    } catch {
      automaticResumeInFlight.current = false;
      setIsResumeCooldownCancelled(false);
      // A transient refresh failure must never turn the active run into a result
      // screen. Keep the queue visible and retry from the same persisted output
      // state until the user explicitly cancels the cooldown or the API recovers.
      setIsInterruptedReview(false);
      startResumeCooldown();
      setState("error");
      setMessage(FLOW_REFRESH_ERROR_MESSAGE);
      return null;
    }
  }, [runId, scopeSearchParams, startResumeCooldown]);

  const browserImageOutputs = useMemo(() => outputs.filter((output) => isAttemptDue(output, now)).filter(isBrowserRenderedImage), [now, outputs]);
  const browserVideoOutputs = useMemo(() => outputs.filter((output) => isAttemptDue(output, now) && output.status === "awaiting_browser_video" && !isBrowserRenderedImage(output)), [now, outputs]);
  const browserImageOutput = browserImageOutputs[0] ?? null;
  const generationQueue = useMemo(() => prioritizeAutomationGenerations(outputs.filter((output) => isAttemptDue(output, now) && (output.status === "queued" || output.status === "generating_video"))), [now, outputs]);
  const nextOutput = useMemo(() => {
    if (browserImageOutputs.length || browserVideoOutputs.length) return null;
    return generationQueue[0] ?? null;
  }, [browserImageOutputs.length, browserVideoOutputs.length, generationQueue]);
  const completeCount = useMemo(() => outputs.filter(isGenerationComplete).length, [outputs]);
  const readyOutputs = useMemo(() => outputs.filter(isReadyForSchedule), [outputs]);
  const providerProcessingOutputs = useMemo(() => outputs.filter((output) => output.schedule_error_code === UPLOAD_POST_REQUEST_UNCONFIRMED_CODE), [outputs]);
  const failedOutputs = useMemo(() => outputs.filter(isFailedAutomationOutput), [outputs]);
  const unresolvedOutputs = useMemo(() => outputs.filter(needsGeneration), [outputs]);
  const staleProcessingOutputs = useMemo(() => outputs.filter((output) => isStaleProcessingOutput(output, now)), [now, outputs]);
  const recoveryOutputs = useMemo(() => [
    ...failedOutputs.filter((output) => output.error_code !== "automation_media_retention_expired"),
    ...staleProcessingOutputs,
  ], [failedOutputs, staleProcessingOutputs]);
  const hasStoppedGeneration = isGenerationStoppedLocally || outputs.some((output) => Boolean(output.run?.generation_stopped_at));
  const isRunFinished = isRunFinishedLocally || outputs.some((output) => Boolean(output.run?.finished_by_user_at));
  const progress = outputs.length ? Math.round((completeCount / outputs.length) * 100) : 0;
  const aiGenerationDividerPercent = useMemo(() => {
    const boundaryIndex = aiGenerationBoundaryIndex(outputs);
    return boundaryIndex > 0 && boundaryIndex < outputs.length ? (boundaryIndex / outputs.length) * 100 : null;
  }, [outputs]);
  const isIdleAfterGeneration = state === "ready" && outputs.length > 0 && !nextOutput && !browserImageOutputs.length && !browserVideoOutputs.length && (!processingOutputId || hasStoppedGeneration);
  const shouldRecoverFailedOutputs = isIdleAfterGeneration && !hasStoppedGeneration && !isInterruptedReview && recoveryOutputs.length > 0 && renderRecoveryAttempt < MAX_AUTOMATIC_RENDER_RECOVERY_ATTEMPTS;
  // Waiting work is not a result. Keep processing visible until each output
  // reaches a successful or a concrete failed state.
  const isReviewReady = isIdleAfterGeneration && !isRecoveringFailedOutputs && !unresolvedOutputs.length && (!recoveryOutputs.length || renderRecoveryAttempt >= MAX_AUTOMATIC_RENDER_RECOVERY_ATTEMPTS);
  const isResultScreen = isReviewReady || isInterruptedReview;
  const activeOutput = processingOutputId ? outputs.find((output) => output.id === processingOutputId) ?? null : browserImageOutputs[0] ?? nextOutput;
  const estimatedSecondsRemaining = useMemo(() => estimateRemainingGenerationSeconds({
    activeElapsedSeconds: processingOutputId && processingStartedAt ? Math.max(0, (now - processingStartedAt) / 1_000) : 0,
    activeOutputId: processingOutputId,
    learnedDurationsMs: modeDurationProfiles,
    outputs: outputs.map((output) => ({ contentType: output.content_type, generator: output.generator, id: output.id, status: output.status })),
  }), [modeDurationProfiles, now, outputs, processingOutputId, processingStartedAt]);
  const resumeCooldownSeconds = state === "error" && !isResumeCooldownCancelled && resumeCooldownEndsAt !== null
    ? Math.max(0, Math.ceil((resumeCooldownEndsAt - now) / 1_000))
    : null;
  const renderRecoverySeconds = renderRecoveryEndsAt === null ? null : Math.max(0, Math.ceil((renderRecoveryEndsAt - now) / 1_000));
  const nextRenderRecoveryDelayMs = AUTOMATION_RETRY_DELAYS_MS[Math.min(renderRecoveryAttempt, AUTOMATION_RETRY_DELAYS_MS.length - 1)]!;

  const processNext = useCallback(async () => {
    if (!nextOutput || processingOutputId || isStoppingGeneration || hasStoppedGeneration) return;
    setProcessingOutputId(nextOutput.id);
    setProcessingStartedAt(Date.now());
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputId: nextOutput.id, scope }),
      });
      const payload = await response.json().catch(() => null) as { outcome?: string; errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_processing_failed");
      if (payload?.outcome === "video_pending") setMessage("Video sağlayıcısının renderı bitirmesi bekleniyor.");
    } catch {
      setMessage("Bir içerik üretilemedi. Review ekranında hata ayrıntısını göreceksin.");
    } finally {
      await load();
      setProcessingOutputId(null);
      setProcessingStartedAt(null);
    }
  }, [hasStoppedGeneration, isStoppingGeneration, load, nextOutput, processingOutputId, scope]);

  const beginBrowserImageRender = useCallback((outputId: string) => {
    setProcessingOutputId(outputId);
    setProcessingStartedAt(Date.now());
    setMessage("");
  }, []);

  const reportBrowserImageFailure = useCallback(async (output: AutomationOutput, error: unknown) => {
    const browserImageError = browserImageFailureCode(error);
    const response = await fetch("/api/twitter-automation/automation-runs/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outputId: output.id, browserImageError, scope }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { errorCode?: string } | null;
      throw new Error(payload?.errorCode ?? "automation_processing_failed");
    }
  }, [scope]);

  const persistBrowserImagePlan = useCallback(async (output: AutomationOutput, browserRenderPlan: unknown, signal?: AbortSignal) => {
    const response = await fetch("/api/twitter-automation/automation-runs/process", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outputId: output.id, browserRenderPlan, scope }),
      signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { errorCode?: string } | null;
      throw new Error(payload?.errorCode ?? "automation_output_plan_save_failed");
    }
  }, [scope]);

  const completeBrowserImageRender = useCallback(async (output: AutomationOutput, result: { caption: string; imageDataUrls: string[] }) => {
    try {
      const stagedMediaPaths = await Promise.all(result.imageDataUrls.map(async (dataUrl, index) => {
        return retryBrowserImageOperation(async () => {
          const imageResponse = await fetch(dataUrl);
          if (!imageResponse.ok) throw new BrowserImageRenderError("browser_image_stage_failed");
          const blob = await imageResponse.blob();
          return stageBrowserImage(blob, output.id, index);
        },
          { failureCode: "browser_image_stage_failed" },
        );
      }));
      await retryBrowserImageOperation(async () => {
        const response = await fetch("/api/twitter-automation/automation-runs/process", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outputId: output.id, stagedMediaPaths: stagedMediaPaths.map((item) => item.path), caption: result.caption, scope }),
        });
        if (!response.ok) throw new Error("automation_processing_failed");
      }, { failureCode: "browser_image_stage_failed" });
    } catch (error) {
      await reportBrowserImageFailure(output, error).catch(() => undefined);
      setMessage("Studio görseli kaydedilemedi. Sayfayı yenileyip tekrar deneyebilirsin.");
    } finally {
      await load();
      setProcessingOutputId(null);
      setProcessingStartedAt(null);
    }
  }, [load, reportBrowserImageFailure, scope]);

  const failBrowserImageRender = useCallback(async (output: AutomationOutput, error: unknown) => {
    setMessage("Studio görseli renderlanamadı. Review ekranında hata ayrıntısını göreceksin.");
    try {
      await reportBrowserImageFailure(output, error);
    } finally {
      await load();
      setProcessingOutputId(null);
      setProcessingStartedAt(null);
    }
  }, [load, reportBrowserImageFailure]);

  const handleBrowserImageStart = useCallback(() => {
    if (browserImageOutput) beginBrowserImageRender(browserImageOutput.id);
  }, [beginBrowserImageRender, browserImageOutput]);

  const handleBrowserImageComplete = useCallback((result: { caption: string; imageDataUrls: string[] }) => {
    if (browserImageOutput) void completeBrowserImageRender(browserImageOutput, result);
  }, [browserImageOutput, completeBrowserImageRender]);

  const handleBrowserImagePlan = useCallback(async (plan: unknown) => {
    if (!browserImageOutput || browserImageOutput.render_plan) return;
    await persistBrowserImagePlan(browserImageOutput, plan);
  }, [browserImageOutput, persistBrowserImagePlan]);

  const handleBrowserImageError = useCallback((error: unknown) => {
    if (browserImageOutput) void failBrowserImageRender(browserImageOutput, error);
  }, [browserImageOutput, failBrowserImageRender]);

  const renderBrowserVideo = useCallback(async (output: AutomationOutput, attempt: number) => {
    if (processingOutputId) return;
    let activeController: AbortController | null = null;
    let activeAbortCode = "browser_video_plan_timeout";
    let timeout: number | null = null;
    const clearActiveTimeout = () => {
      if (timeout !== null) window.clearTimeout(timeout);
      timeout = null;
    };
    let shouldRetry = false;
    let hasPreparedPlan = false;
    setProcessingOutputId(output.id);
    setProcessingStartedAt(Date.now());
    setMessage("");
    try {
      const planController = new AbortController();
      activeController = planController;
      activeAbortCode = "browser_video_plan_timeout";
      timeout = window.setTimeout(() => planController.abort(), BROWSER_VIDEO_PLAN_TIMEOUT_MS);
      const plan = await getOrCreateBrowserVideoPlan(browserVideoPlans.current, output, planController.signal);
      hasPreparedPlan = true;
      if (!output.render_plan) await persistBrowserImagePlan(output, plan, planController.signal);
      const sourceUrl = await resolveBrowserMusicVideoSourceUrl(output, scope, planController.signal);
      clearActiveTimeout();

      const renderController = new AbortController();
      activeController = renderController;
      activeAbortCode = "browser_video_render_timeout";
      const resetRenderStallWatchdog = () => {
        clearActiveTimeout();
        timeout = window.setTimeout(() => renderController.abort(), BROWSER_VIDEO_RENDER_STALL_TIMEOUT_MS);
      };
      resetRenderStallWatchdog();
      const blob = await renderPreparedBrowserVideo(sourceUrl ? { ...output, mediaUrl: sourceUrl } : output, plan, renderController.signal, resetRenderStallWatchdog);
      clearActiveTimeout();

      let staged: Awaited<ReturnType<typeof stageBrowserVideo>>;
      try {
        staged = await stageBrowserVideo(blob, "automation-video", output.id);
      } catch {
        throw new Error("browser_video_stage_failed");
      }
      const response = await fetch("/api/twitter-automation/automation-runs/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputId: output.id, stagedMediaPath: staged.path, ...(plan.kind === "music" ? {} : { caption: plan.caption }), scope }),
      });
      if (!response.ok) throw new Error("browser_video_stage_failed");
    } catch (error) {
      const errorCode = activeController?.signal.aborted ? activeAbortCode : browserVideoFailureCode(error);
      if (shouldRetryBrowserVideo(attempt) && shouldRetryBrowserVideoFailure(errorCode)) {
        shouldRetry = true;
        setMessage(hasPreparedPlan
          ? `${getOutputLabel(output)} render işlemi ilerlemedi. Güvenli iptal sonrası ${attempt + 1}. deneme hazırlanıyor.`
          : `${getOutputLabel(output)} plan/ses hazırlığı tamamlanmadı. ${attempt + 1}. deneme hazırlanıyor.`);
      } else {
        try {
          const failureResponse = await fetch("/api/twitter-automation/automation-runs/process", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ outputId: output.id, browserVideoError: errorCode, scope }),
          });
          if (!failureResponse.ok) throw new Error("automation_video_failure_update_failed");
          setMessage(`${getOutputLabel(output)} tamamlanamadı (${errorCode}); kuyruk sonraki içerikle devam ediyor.`);
        } catch {
          setMessage(`${getOutputLabel(output)} renderlanamadı ve hata durumu kaydedilemedi.`);
        }
      }
    } finally {
      clearActiveTimeout();
      await load();
      setProcessingOutputId(null);
      setProcessingStartedAt(null);
      if (shouldRetry) {
        const retryTimer = window.setTimeout(() => {
          browserVideoRetryTimers.current.delete(retryTimer);
          autoStartedBrowserVideoIds.current.delete(output.id);
          setBrowserVideoRetryToken((current) => current + 1);
        }, browserVideoRetryDelayMs(attempt));
        browserVideoRetryTimers.current.add(retryTimer);
      } else {
        const recoveryTimer = window.setTimeout(() => {
          browserVideoRetryTimers.current.delete(recoveryTimer);
          autoStartedBrowserVideoIds.current.delete(output.id);
          setBrowserVideoRetryToken((current) => current + 1);
        }, 31_000);
        browserVideoRetryTimers.current.add(recoveryTimer);
        browserVideoAttempts.current.delete(output.id);
        browserVideoPlans.current.delete(output.id);
      }
    }
  }, [load, persistBrowserImagePlan, processingOutputId, scope]);

  const scheduleAll = useCallback(async () => {
    if (isTestAutomation || isRunFinished || !readyOutputs.length || isSchedulingAll || processingOutputId || retryingOutputId) return;
    setIsSchedulingAll(true);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, scope }),
      });
      const payload = await response.json().catch(() => null) as { scheduled?: number; failed?: number; processing?: number; skipped?: number; errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_schedule_failed");
      const scheduledCount = payload?.scheduled ?? 0;
      const skippedMessage = payload?.skipped ? ` ${payload.skipped} hazır olmayan içerik atlandı.` : "";
      const processingMessage = payload?.processing
        ? ` ${payload.processing} içerik Upload-Post tarafından işleniyor; aynı medya tekrar yüklenmedi, durum tekrar kontrol edilecek.`
        : "";
      setMessage(payload?.failed
        ? `${scheduledCount} içerik schedule edildi; ${payload.failed} içerik schedule edilemedi.${processingMessage}${skippedMessage}`
        : payload?.processing
          ? `${scheduledCount} içerik schedule edildi.${processingMessage}${skippedMessage}`
          : `${scheduledCount} içerik belirlenen tarih ve saatlere schedule edildi.${skippedMessage}`);
    } catch {
      setMessage("İçerikler schedule edilemedi. Review ekranındaki içerikler korunuyor; tekrar deneyebilirsin.");
    } finally {
      await load();
      setIsSchedulingAll(false);
    }
  }, [isRunFinished, isSchedulingAll, isTestAutomation, load, processingOutputId, readyOutputs.length, retryingOutputId, runId, scope]);

  const stopGeneration = useCallback(async () => {
    if (isStoppingGeneration || hasStoppedGeneration || !outputs.length || isRunFinished) return;
    setIsStoppingGeneration(true);
    setIsGenerationStoppedLocally(true);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, action: "stop-generation", scope }),
      });
      const payload = await response.json().catch(() => null) as { errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_run_stop_failed");
      setIsInterruptedReview(false);
      await load(true);
      setMessage("Yeni içerik üretimi durduruldu. Hazır içerikleri şimdi gözden geçirip schedule edebilirsin.");
    } catch {
      const refreshed = await load(true);
      const stopped = Boolean(refreshed?.some((output) => output.run?.generation_stopped_at));
      setIsGenerationStoppedLocally(stopped);
      setMessage(stopped
        ? "Üretim durduruldu; hazır içerikler korunuyor."
        : "Üretim durdurulamadı. Aynı run güvenle devam ediyor; tekrar deneyebilirsin.");
    } finally {
      setIsStoppingGeneration(false);
    }
  }, [hasStoppedGeneration, isRunFinished, isStoppingGeneration, load, outputs.length, runId, scope]);

  const finishRun = useCallback(async () => {
    if (isFinishingRun || isRunFinished || isSchedulingAll || processingOutputId || retryingOutputId || unresolvedOutputs.length) return;
    if (providerProcessingOutputs.length) {
      setMessage("Upload-Post tarafında işlenen medya var; run'ı bitirmeden önce yayın durumunun kesinleşmesini beklemeliyiz.");
      return;
    }
    setIsFinishingRun(true);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, action: "finish", scope }),
      });
      const payload = await response.json().catch(() => null) as { errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_run_finish_failed");
      setIsRunFinishedLocally(true);
      await load();
      setMessage("Bu toplu üretim run'ı tamamlandı.");
    } catch {
      setMessage("Run tamamlanamadı. Devam eden işlemler bittiğinde tekrar deneyebilirsin.");
    } finally {
      setIsFinishingRun(false);
    }
  }, [isFinishingRun, isRunFinished, isSchedulingAll, load, processingOutputId, providerProcessingOutputs.length, retryingOutputId, runId, scope, unresolvedOutputs.length]);

  const retryScheduleOutput = useCallback(async (output: AutomationOutput) => {
    if (isTestAutomation || processingOutputId || retryingOutputId || isSchedulingAll) return;
    setRetryingOutputId(output.id);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, outputId: output.id, scope }),
      });
      const payload = await response.json().catch(() => null) as { scheduled?: number; failed?: number; processing?: number; errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_schedule_failed");
      setMessage(payload?.processing
        ? `${getOutputLabel(output)} Upload-Post'ta işleniyor; tekrar yükleme yapılmadı. Biraz sonra durumu yeniden kontrol et.`
        : payload?.failed
          ? `${getOutputLabel(output)} schedule edilemedi; oluşturulan içerik korunuyor. Tekrar deneyebilirsin.`
          : `${getOutputLabel(output)} schedule edildi.`);
    } catch {
      setMessage(`${getOutputLabel(output)} schedule edilemedi. Üretilen içerik korunuyor; schedule işlemini tekrar deneyebilirsin.`);
    } finally {
      await load();
      setRetryingOutputId(null);
    }
  }, [isSchedulingAll, isTestAutomation, load, processingOutputId, retryingOutputId, runId, scope]);

  const refreshGeneratedMedia = useCallback(async () => {
    if (isRefreshingGeneratedMedia || processingOutputId) return;
    setIsRefreshingGeneratedMedia(true);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/refresh-media", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, scope }),
      });
      const payload = await response.json().catch(() => null) as { checked?: number; invalid?: number; unavailable?: number; errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_media_refresh_failed");
      const invalidMessage = payload?.invalid ? ` ${payload.invalid} eksik veya geçersiz medya hatalı olarak işaretlendi.` : "";
      const unavailableMessage = payload?.unavailable ? ` ${payload.unavailable} medya Storage geçici olarak yanıt vermediği için korunuyor.` : "";
      setMessage(`${payload?.checked ?? 0} medya önizlemesi Storage’dan yeniden doğrulandı.${invalidMessage}${unavailableMessage}`);
      await load(false, true);
    } catch {
      setMessage("Medya önizlemeleri yenilenemedi. İçerik durumları korunuyor; tekrar deneyebilirsin.");
    } finally {
      setIsRefreshingGeneratedMedia(false);
    }
  }, [isRefreshingGeneratedMedia, load, processingOutputId, runId, scope]);

  const resumeAutomation = useCallback(async () => {
    if (hasStoppedGeneration || processingOutputId || retryingOutputId) return;
    setMessage("");
    const refreshedOutputs = await load(true);
    if (!refreshedOutputs) return;
    setIsInterruptedReview(false);
    if (refreshedOutputs.some(needsGeneration)) setMessage("Bağlantı geri geldi. Üretim kuyruğu kaldığı yerden devam ediyor.");
  }, [hasStoppedGeneration, load, processingOutputId, retryingOutputId]);

  const cancelResumeCooldown = useCallback(() => {
    setIsResumeCooldownCancelled(true);
    setResumeCooldownEndsAt(null);
  }, []);

  const retryOutput = useCallback(async (output: AutomationOutput) => {
    if (hasStoppedGeneration || isRunFinished || processingOutputId || retryingOutputId) return;

    setRetryingOutputId(output.id);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/retry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputId: output.id, scope }),
      });
      const payload = await response.json().catch(() => null) as { status?: AutomationOutputStatus; errorCode?: string } | null;
      if (!response.ok || !payload?.status) throw new Error(payload?.errorCode ?? "automation_retry_failed");

      autoStartedBrowserVideoIds.current.delete(output.id);
      browserVideoAttempts.current.delete(output.id);
      automaticResumeInFlight.current = false;
      setResumeCooldownEndsAt(null);
      setIsResumeCooldownCancelled(false);
      setRenderRecoveryAttempt(0);
      setRenderRecoveryEndsAt(null);
      setOutputs((current) => current.map((item) => item.id === output.id ? {
        ...item,
        status: payload.status!,
        error_code: null,
      } : item));
      setState("ready");
      setIsInterruptedReview(false);
      setMessage(payload.status === "ready_to_schedule" ? `${getOutputLabel(output)} tekrar hazırlandı.` : `${getOutputLabel(output)} yeniden üretim sırasına alındı.`);
    } catch {
      setMessage("İçerik yeniden denemeye alınamadı. Tekrar deneyebilirsin.");
    } finally {
      setRetryingOutputId(null);
    }
  }, [hasStoppedGeneration, isRunFinished, processingOutputId, retryingOutputId, scope]);

  const deleteOutput = useCallback(async (output: AutomationOutput) => {
    if (deletingOutputId || processingOutputId || output.status === "scheduled") return;
    if (!window.confirm("Bu generated postu ve bağlı Storage medyalarını silmek istediğine emin misin?")) return;
    setDeletingOutputId(output.id);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/output", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputId: output.id, scope }),
      });
      const payload = await response.json().catch(() => null) as { errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_output_delete_failed");
      bucketStatusByOutputId.current.delete(output.id);
      setOutputs((current) => current.filter((item) => item.id !== output.id));
      setMessage("İçerik ve Storage kaydı silindi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İçerik silinemedi.");
    } finally {
      setDeletingOutputId(null);
    }
  }, [deletingOutputId, processingOutputId, scope]);

  const retryRecoveryOutputs = useCallback(async (recoverableOutputs: AutomationOutput[]) => {
    if (!recoverableOutputs.length || processingOutputId || retryingOutputId || isRecoveringFailedOutputs) return;

    setIsRecoveringFailedOutputs(true);
    setMessage("");
    try {
      let nextRecoveryIndex = 0;
      const retryOne = async (output: AutomationOutput) => {
        try {
          const response = await fetch("/api/twitter-automation/automation-runs/retry", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ outputId: output.id, scope }),
          });
          const payload = await response.json().catch(() => null) as { status?: AutomationOutputStatus; errorCode?: string } | null;
          if (!response.ok || !payload?.status) return null;
          return { id: output.id, status: payload.status };
        } catch {
          return null;
        }
      };
      const worker = async () => {
        const results: Array<{ id: string; status: AutomationOutputStatus } | null> = [];
        while (nextRecoveryIndex < recoverableOutputs.length) {
          const output = recoverableOutputs[nextRecoveryIndex++];
          if (!output) continue;
          results.push(await retryOne(output));
        }
        return results;
      };
      const results = (await Promise.all(Array.from({ length: Math.min(RECOVERY_RETRY_CONCURRENCY, recoverableOutputs.length) }, () => worker()))).flat();
      const retriedOutputs = results.filter((result): result is { id: string; status: AutomationOutputStatus } => result !== null);

      retriedOutputs.forEach((result) => {
        autoStartedBrowserVideoIds.current.delete(result.id);
        browserVideoAttempts.current.delete(result.id);
      });
      if (retriedOutputs.length) {
        const retryStatuses = new Map(retriedOutputs.map((result) => [result.id, result.status]));
        setOutputs((current) => current.map((output) => {
          const status = retryStatuses.get(output.id);
          return status ? { ...output, status, error_code: null } : output;
        }));
        setMessage(`${retriedOutputs.length} tamamlanamayan işlem yeniden denemeye alındı.`);
      } else {
        setMessage("Tamamlanamayan işlemler yeniden denemeye alınamadı.");
      }
      await load();
    } finally {
      setIsRecoveringFailedOutputs(false);
      setRenderRecoveryEndsAt(null);
    }
  }, [isRecoveringFailedOutputs, load, processingOutputId, retryingOutputId, scope]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(true), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!isResultScreen || state !== "ready" || resultMediaLoadedForRun.current === runId) return;
    resultMediaLoadedForRun.current = runId;
    void load(false, true);
  }, [isResultScreen, load, runId, state]);

  useEffect(() => {
    if (!isResultScreen) resultMediaLoadedForRun.current = null;
  }, [isResultScreen]);

  useEffect(() => {
    if (state !== "error" || isResumeCooldownCancelled || resumeCooldownEndsAt === null) return;
    const timer = window.setTimeout(() => {
      if (processingOutputId || retryingOutputId || automaticResumeInFlight.current) return;
      automaticResumeInFlight.current = true;
      setResumeCooldownEndsAt(null);
      void resumeAutomation();
    }, Math.max(0, resumeCooldownEndsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [isResumeCooldownCancelled, processingOutputId, resumeAutomation, resumeCooldownEndsAt, retryingOutputId, state]);

  useEffect(() => {
    if (!shouldRecoverFailedOutputs || isRecoveringFailedOutputs || renderRecoveryEndsAt !== null) return;
    const timer = window.setTimeout(() => {
      const startedAt = Date.now();
      setNow(startedAt);
      setRenderRecoveryEndsAt(startedAt + nextRenderRecoveryDelayMs);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isRecoveringFailedOutputs, nextRenderRecoveryDelayMs, renderRecoveryEndsAt, shouldRecoverFailedOutputs]);

  useEffect(() => {
    if (!shouldRecoverFailedOutputs || isRecoveringFailedOutputs || renderRecoveryEndsAt === null) return;
    const timer = window.setTimeout(() => {
      setRenderRecoveryAttempt((current) => current + 1);
      setRenderRecoveryEndsAt(null);
      void retryRecoveryOutputs(recoveryOutputs);
    }, Math.max(0, renderRecoveryEndsAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [isRecoveringFailedOutputs, recoveryOutputs, renderRecoveryEndsAt, retryRecoveryOutputs, shouldRecoverFailedOutputs]);

  useEffect(() => {
    if (hasStoppedGeneration || isStoppingGeneration || !nextOutput || processingOutputId || state !== "ready" || isRecoveringFailedOutputs) return;
    const delay = nextOutput.status === "generating_video" ? 8_000 : 500;
    const timer = window.setTimeout(() => void processNext(), delay);
    return () => window.clearTimeout(timer);
  }, [hasStoppedGeneration, isRecoveringFailedOutputs, isStoppingGeneration, nextOutput, processNext, processingOutputId, state]);

  useEffect(() => {
    const hasPendingServerProcessing = unresolvedOutputs.some((output) => output.status === "processing");
    const hasDelayedRecovery = unresolvedOutputs.some((output) => !isAttemptDue(output, Date.now()));
    if (hasStoppedGeneration || (!nextOutput && !hasPendingServerProcessing && !hasDelayedRecovery) || processingOutputId || state !== "ready" || isInterruptedReview || isRecoveringFailedOutputs) return;
    const timer = window.setInterval(() => void load(), nextOutput?.status === "generating_video" ? 8_000 : 4_000);
    return () => window.clearInterval(timer);
  }, [hasStoppedGeneration, isInterruptedReview, isRecoveringFailedOutputs, load, nextOutput, processingOutputId, state, unresolvedOutputs]);

  useEffect(() => {
    if (hasStoppedGeneration || isStoppingGeneration || state !== "ready" || processingOutputId || isInterruptedReview || isRecoveringFailedOutputs) return;
    const nextBrowserVideo = browserVideoOutputs.find((output) => !autoStartedBrowserVideoIds.current.has(output.id));
    if (!nextBrowserVideo) return;

    const attempt = (browserVideoAttempts.current.get(nextBrowserVideo.id) ?? 0) + 1;
    browserVideoAttempts.current.set(nextBrowserVideo.id, attempt);
    autoStartedBrowserVideoIds.current.add(nextBrowserVideo.id);
    const timer = window.setTimeout(() => void renderBrowserVideo(nextBrowserVideo, attempt), 0);
    return () => window.clearTimeout(timer);
  }, [browserVideoOutputs, browserVideoRetryToken, hasStoppedGeneration, isInterruptedReview, isRecoveringFailedOutputs, isStoppingGeneration, processingOutputId, renderBrowserVideo, state]);

  useEffect(() => () => {
    browserVideoRetryTimers.current.forEach((timer) => window.clearTimeout(timer));
    browserVideoRetryTimers.current.clear();
    browserVideoPlans.current.clear();
    void closeAutomationMusicVideoAudioSession();
  }, []);

  useEffect(() => {
    if (isReviewReady) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [isReviewReady]);

  useEffect(() => {
    if (!processingOutputId) return;
    const heartbeat = () => void fetch("/api/twitter-automation/renderers/heartbeat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ outputId: processingOutputId }),
    }).catch(() => undefined);
    heartbeat();
    const timer = window.setInterval(heartbeat, 15_000);
    return () => window.clearInterval(timer);
  }, [processingOutputId]);

  const renderRecoveryStatus = isRecoveringFailedOutputs
    ? `${recoveryOutputs.length} tamamlanamayan işlem yeniden deneniyor (${renderRecoveryAttempt}/${MAX_AUTOMATIC_RENDER_RECOVERY_ATTEMPTS}).`
    : renderRecoverySeconds !== null
      ? `${recoveryOutputs.length} tamamlanamayan işlem ${renderRecoverySeconds} sn sonra yeniden denenecek (${renderRecoveryAttempt + 1}/${MAX_AUTOMATIC_RENDER_RECOVERY_ATTEMPTS}).`
      : shouldRecoverFailedOutputs
        ? `${recoveryOutputs.length} tamamlanamayan işlem için yeniden deneme hazırlanıyor.`
        : null;
  const progressStatus = renderRecoveryStatus ?? (browserVideoOutputs.length
    ? "Sesli videolar sırayla renderlanıyor"
    : activeOutput
      ? generationStatusText(activeOutput, Boolean(processingOutputId))
      : state === "loading"
        ? "İçerik sırası hazırlanıyor"
        : "İçerikler hazırlanıyor");
  const scheduleDateText = formatRunDate(outputs.find((output) => output.run?.schedule_date)?.run?.schedule_date);

  return <section aria-labelledby={`automation-run-${runId}-title`} aria-live="polite" className="flex max-h-[calc(100dvh-2rem)] w-[min(70rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-[#2c63e1] text-white shadow-sm">
    {state === "ready" && !isInterruptedReview && !hasStoppedGeneration && !isStoppingGeneration && browserImageOutput ? <AutomationBrowserImageRenderer
      key={browserImageOutput.id}
      onComplete={handleBrowserImageComplete}
      onError={handleBrowserImageError}
      onPlan={handleBrowserImagePlan}
      onStart={handleBrowserImageStart}
      output={browserImageOutput}
    /> : null}
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 px-4">
      <div className="min-w-0"><p className="truncate text-sm font-semibold" id={`automation-run-${runId}-title`}>{isRunFinished ? "Tamamlanan toplu üretim" : isResultScreen ? "Üretilen içerikler" : "İçerikler hazırlanıyor"}</p><p className="truncate text-xs text-white">{outputs.length} içerik · {completeCount} başarılı{scheduleDateText ? ` · Yayın günü: ${scheduleDateText}` : ""}</p></div>
      <div className="flex items-center gap-2"><Button aria-label="İçerik durumunu yenile" className="size-8 rounded border-transparent bg-white/[0.06] p-0 text-white hover:bg-white/[0.12]" disabled={state === "loading" || Boolean(processingOutputId) || isSchedulingAll || isRefreshingGeneratedMedia} onClick={() => void load(true)} type="button"><RefreshCw className={cn("size-3.5", (state === "loading" || isRefreshingGeneratedMedia) && "animate-spin")} /></Button><Button className="h-8 rounded border-white/10 bg-white/[0.06] px-3 text-xs text-white hover:bg-white/[0.12]" disabled={Boolean(processingOutputId) || isSchedulingAll || isRefreshingGeneratedMedia || (state === "ready" && !isReviewReady)} onClick={onClose} type="button"><X className="size-3.5" />Kapat</Button></div>
    </header>

    {!isResultScreen ? <main className="grid min-h-[27rem] place-items-center p-6 text-center">
      <div className="w-full max-w-xl">
        <div className="relative mx-auto grid size-14 place-items-center">
          <LoaderCircle aria-label="İçerik üretimi sürüyor" className="size-12 animate-spin text-white motion-reduce:animate-none" data-testid="automation-loading-indicator" />
          {browserVideoOutputs.length ? <Video aria-hidden="true" className="absolute size-4 text-white" data-testid="automation-current-content-icon" /> : browserImageOutputs.length ? <ImageIcon aria-hidden="true" className="absolute size-4 text-white" data-testid="automation-current-content-icon" /> : null}
        </div>
        <h2 className="mt-4 font-display text-3xl font-semibold">{renderRecoveryStatus ? "Tamamlanamayan işlemler yeniden deneniyor" : browserVideoOutputs.length ? "Sesli videolar renderlanıyor" : browserImageOutputs.length ? "Studio görseli renderlanıyor" : "İçerikler sırayla üretiliyor"}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white">{renderRecoveryStatus ?? (browserVideoOutputs.length ? `${browserVideoOutputs.length} video kaynağı hazır. Ses ekleme otomatik olarak devam ediyor; hata alan içerik işaretlenip kuyruk korunur.` : browserImageOutputs.length ? "Bu görsel, Content Automation ile aynı tasarım bileşenlerinden hazırlanıyor." : progressStatus)}</p>
         <div aria-label="İçerik üretim ilerlemesi" aria-valuemax={outputs.length} aria-valuemin={0} aria-valuenow={completeCount} aria-valuetext={`${completeCount} / ${outputs.length} içerik hazır`} className="relative mt-7 h-5 overflow-hidden rounded bg-[#1f4ea8]" role="progressbar"><div className="h-full rounded bg-white" style={{ width: `${progress}%` }} />{aiGenerationDividerPercent !== null ? <span aria-label="AI üretim sırasının başlangıcı" className="absolute inset-y-0 z-10 border-l-2 border-[#2c63e1]" data-testid="automation-ai-generation-divider" style={{ left: `${aiGenerationDividerPercent}%` }} title="Bu çizgiden sonra AI üretimleri başlar" /> : null}{isTestAutomation ? <span className="absolute inset-0 grid place-items-center text-[10px] font-bold tracking-[0.25em] text-black">TEST</span> : null}</div>
        <div className="mt-3 flex items-center justify-between text-xs text-white"><span>{completeCount} / {outputs.length || "…"} hazır</span><span>{progress}%</span></div>
        <AutomationGenerationStatusSummary labelForGenerator={(generator) => getOutputLabel({ generator })} outputs={outputs} />
        <p className="mt-2 text-xs text-white">{`Tahmini kalan süre: ${formatEstimatedDuration(estimatedSecondsRemaining)}`}</p>
        {message && !renderRecoveryStatus ? <p className="mt-5 text-sm text-[#ffb9c1]">{message}</p> : null}
        {state === "error" ? <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button className="h-9 border border-[#f1c75b]/50 bg-[#312816] px-3 text-xs text-[#ffe7a0] hover:bg-[#40351e]" onClick={() => setIsInterruptedReview(true)} type="button">Sonuç ekranına git</Button>
          <ResumeAutomationControl cooldownSeconds={resumeCooldownSeconds} disabled={Boolean(processingOutputId) || Boolean(retryingOutputId)} onCancelCooldown={cancelResumeCooldown} onResume={() => void resumeAutomation()} />
        </div> : null}
      </div>
    </main> : <main className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{outputs.map((output) => {
        const ready = isReadyForSchedule(output);
        const scheduled = output.status === "scheduled";
        const skipped = output.status === "skipped";
        const providerProcessing = output.schedule_error_code === UPLOAD_POST_REQUEST_UNCONFIRMED_CODE;
        const scheduleFailed = !providerProcessing && (output.schedule_status === "failed" || output.schedule_status === "partially_scheduled");
        const providerRecheckReady = providerProcessing && now - Date.parse(output.schedule_attempted_at ?? "") >= UPLOAD_POST_REQUEST_RECHECK_DELAY_MS;
        const isPendingVerification = needsGeneration(output);
        const canRetry = output.status === "failed" || isPendingVerification;
        const storageStatus = bucketStatusLabel(output);
        return <article className="overflow-hidden rounded-2xl border border-white/30 bg-white p-3 text-black" key={output.id}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-black">{output.group_name}</p><p className="mt-1 truncate text-[11px] text-black">{getOutputLabel(output)}</p></div>{scheduleFailed ? <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#b42318]"><CircleAlert aria-label="Schedule başarısız" className="size-4" />Schedule hatası</div> : ready || scheduled ? <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-black"><Check aria-label="İçerik başarılı" className="size-4" />Başarılı</div> : skipped ? <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#64748b]"><CircleAlert aria-label="İçerik atlandı" className="size-4" />Atlandı</div> : isPendingVerification ? <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-black"><CircleAlert aria-label="İçerik beklemede" className="size-4" />Beklemede</div> : <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-black"><CircleAlert aria-label="İçerik üretilemedi" className="size-4" />Üretim hatası</div>}</div>
          {providerProcessing ? <div className="mt-3 rounded-lg border border-[#f1d28a] bg-[#fff9e8] px-2.5 py-2 text-[11px] leading-4 text-[#795600]">Upload-Post yanıtı henüz doğrulanmadı. Olası çift paylaşımı önlemek için aynı medya yeniden gönderilmeden önce mevcut istek kontrol edilecek.</div> : null}
          <div className="mt-3 flex items-center gap-2 text-xs text-black"><CalendarClock className="size-3.5 shrink-0 text-black" /><span>{scheduled ? "Schedule edildi:" : "Schedule zamanı:"} {formatScheduledAt(output.scheduled_at)}</span></div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold"><span className={storageStatus.className}>{storageStatus.label}</span><span className="font-mono text-[10px] text-black/55">#{output.id.slice(0, 8)}</span></div>
          <div className="relative mt-3">
            {output.mediaUrls?.length ? <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl border border-black/10 bg-black p-1">{output.mediaUrls.map((mediaUrl, index) => <div className="relative aspect-[3/4] overflow-hidden rounded-lg" key={mediaUrl}><Image alt={`${output.group_name} görseli ${index + 1}`} className="object-cover" fill sizes="(min-width: 1280px) 7rem, (min-width: 768px) 9vw, 28vw" src={mediaUrl} unoptimized /></div>)}</div> : output.mediaUrl ? <div className="overflow-hidden rounded-xl border border-black/10 bg-black">{output.media_type === "video" ? <video className="aspect-video w-full object-contain" controls src={output.mediaUrl} /> : <div className="relative aspect-square"><Image alt={`${output.group_name} üretilen içerik`} className="object-contain" fill sizes="(min-width: 1280px) 22rem, (min-width: 768px) 30vw, 90vw" src={output.mediaUrl} unoptimized /></div>}</div> : output.content_type === "text" ? <div className="flex min-h-28 items-start gap-2 rounded-xl border border-black/10 bg-[#f5f7fb] p-3 text-xs leading-5 text-black"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-black" /><p>{output.caption ?? "Metin içeriği hazırlanamadı."}</p></div> : <div className="grid aspect-square place-items-center rounded-xl border border-dashed border-black/10 bg-[#f5f7fb] text-black">{output.content_type === "video" ? <Video className="size-6" /> : <ImageIcon className="size-6" />}</div>}
            <MediaStatusHint errorCode={output.error_code} errorDetail={formatProviderFailureDetail(output)} pendingMessage={isPendingVerification ? pendingGenerationMessage(output, isInterruptedReview) : undefined} />
          </div>
          {scheduleFailed ? <div className="mt-3 rounded-lg border border-[#f4b9b4] bg-[#fff0ef] px-2.5 py-2 text-[11px] leading-4 text-[#8e2118]">Schedule başarısız oldu; üretim dosyaları ve içerik korunuyor. Hata: {output.schedule_error_detail ?? output.schedule_error_code ?? "automation_schedule_failed"}</div> : null}
          {providerProcessing ? <Button className="mt-3 h-8 w-full border border-[#f1c75b]/50 bg-[#312816] px-3 text-xs text-[#ffe7a0] hover:bg-[#40351e]" disabled={!providerRecheckReady || isTestAutomation || isRunFinished || Boolean(processingOutputId) || Boolean(retryingOutputId) || isSchedulingAll} onClick={() => void retryScheduleOutput(output)} type="button">{retryingOutputId === output.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}{providerRecheckReady ? "Upload-Post durumunu kontrol et" : "Upload-Post işlemi sürüyor"}</Button> : null}
          {scheduleFailed && output.schedule_error_code !== "automation_scheduled_at_in_past" ? <Button className="mt-3 h-8 w-full border border-[#f1c75b]/50 bg-[#312816] px-3 text-xs text-[#ffe7a0] hover:bg-[#40351e]" disabled={isTestAutomation || isRunFinished || Boolean(processingOutputId) || Boolean(retryingOutputId) || isSchedulingAll} onClick={() => void retryScheduleOutput(output)} type="button">{retryingOutputId === output.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}Schedule&apos;ı yeniden dene</Button> : canRetry && !hasStoppedGeneration && !isRunFinished ? <Button className={cn("mt-3 h-8 w-full px-3 text-xs", isPendingVerification ? "border border-[#f1c75b]/50 bg-[#312816] text-[#ffe7a0] hover:bg-[#40351e]" : "border border-[#ffb9c1]/45 bg-[#3b211e] text-[#ffd9de] hover:bg-[#4a2822]")} disabled={Boolean(processingOutputId) || Boolean(retryingOutputId)} onClick={() => void retryOutput(output)} type="button">{retryingOutputId === output.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}{isPendingVerification ? "Yeniden dene" : "Yeniden üret"}</Button> : null}
          {!scheduled ? <Button aria-label="Generated postu ve Storage kaydını sil" className="mt-2 h-8 w-full border border-[#fecaca] bg-[#fff1f2] px-3 text-xs text-[#c0262d] hover:bg-[#fee2e2]" disabled={Boolean(processingOutputId) || Boolean(retryingOutputId) || Boolean(deletingOutputId)} onClick={() => void deleteOutput(output)} title="Generated postu ve Storage kaydını sil" type="button">{deletingOutputId === output.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}İçeriği ve Storage kaydını sil</Button> : null}
        </article>;
      })}</div>
    </main>}

    {isResultScreen ? <footer className="flex shrink-0 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-white">{isRunFinished ? "Bu toplu üretim run'ı tamamlandı." : isInterruptedReview ? FLOW_REFRESH_ERROR_MESSAGE : isTestAutomation ? "TEST modu: üretilen içerikler production'a schedule edilemez." : message || (readyOutputs.length ? `${readyOutputs.length} içerik schedule onayını bekliyor.` : "Schedule edilecek hazır içerik kalmadı.")}</p><div className="flex flex-wrap gap-2">{isInterruptedReview && !hasStoppedGeneration ? <ResumeAutomationControl cooldownSeconds={resumeCooldownSeconds} disabled={Boolean(processingOutputId) || Boolean(retryingOutputId)} onCancelCooldown={cancelResumeCooldown} onResume={() => void resumeAutomation()} /> : null}<div className="flex flex-col gap-2">{!hasStoppedGeneration && unresolvedOutputs.length > 0 ? <Button className="h-10 border border-white/20 bg-white/[0.08] px-4 text-sm text-white hover:bg-white/[0.14] disabled:opacity-45" disabled={isStoppingGeneration || isRunFinished} onClick={() => void stopGeneration()} type="button">{isStoppingGeneration ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Kalanları atla</Button> : null}<Button className="h-10 bg-white px-4 text-sm text-[#2c63e1] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45" disabled={isRunFinished || isTestAutomation || !readyOutputs.length || isSchedulingAll || Boolean(processingOutputId) || Boolean(retryingOutputId) || isRefreshingGeneratedMedia} onClick={() => void scheduleAll()} title={isTestAutomation ? "TEST modunda production scheduling kapalıdır" : "Yalnızca hazır içerikler schedule edilir; başarısız olanlar schedule olarak yeniden denenir."} type="button">{isTestAutomation ? <CalendarClock className="size-4" /> : isSchedulingAll ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}{isTestAutomation ? "Schedule all kilitli (TEST)" : `Schedule all (${readyOutputs.length})`}</Button><Button className="h-9 border border-white/15 bg-white/[0.06] px-4 text-xs text-white hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-45" disabled={isRunFinished || Boolean(processingOutputId) || Boolean(retryingOutputId) || isSchedulingAll || isRefreshingGeneratedMedia} onClick={() => void refreshGeneratedMedia()} title="Önizlemeleri Storage’dan yeniden yükle ve medyayı doğrula" type="button">{isRefreshingGeneratedMedia ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}Önizlemeleri yenile</Button>{!isRunFinished ? <Button className="h-10 bg-[#c7f05d] px-4 text-sm font-semibold text-[#17240a] hover:bg-[#d6ff74] disabled:cursor-not-allowed disabled:opacity-45" disabled={isFinishingRun || isSchedulingAll || Boolean(processingOutputId) || Boolean(retryingOutputId) || unresolvedOutputs.length > 0 || isRefreshingGeneratedMedia} onClick={() => void finishRun()} title="Bu batch'i sonlandır; daha sonra bu run'a üretim eklenmez." type="button">{isFinishingRun ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{isFinishingRun ? "Run bitiriliyor…" : "Run'ı bitir"}</Button> : null}</div></div></footer> : <footer className="flex min-h-12 shrink-0 items-center justify-between gap-3 px-4 py-2 text-xs text-white"><span>{renderRecoveryStatus || message || progressStatus}</span><Button className="h-9 shrink-0 bg-white px-3 text-xs font-semibold text-[#2c63e1] hover:bg-white/90 disabled:opacity-50" disabled={!outputs.length || state === "loading" || isStoppingGeneration || hasStoppedGeneration || isRunFinished} onClick={() => void stopGeneration()} type="button">{isStoppingGeneration ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}{isStoppingGeneration ? "Durduruluyor…" : "Bu kadarı yeterli — sonuçlara geç"}</Button></footer>}
  </section>;
}
