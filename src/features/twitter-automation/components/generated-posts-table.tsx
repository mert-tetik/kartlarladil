"use client";

import { CalendarClock, Check, CircleAlert, ImageIcon, LoaderCircle, MessageSquareText, RefreshCw, Video, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { estimateRemainingGenerationSeconds, formatEstimatedDuration } from "@/features/twitter-automation/automation-generation-estimates";
import { stageBrowserImage, stageBrowserVideo } from "@/features/twitter-automation/browser-media-stage";
import { AutomationBrowserImageRenderer, type AutomationBrowserImageOutput } from "@/features/twitter-automation/components/automation-browser-image-renderer";
import { renderConfusedWordsVideo, type ConfusedWordsVideoScene } from "@/features/twitter-automation/confused-words-video-renderer";
import { renderDialogueVideo, type DialogueVideoScene } from "@/features/twitter-automation/dialogue-video-renderer";
import { prepareMusicVideoAudio, renderMusicVideo } from "@/features/twitter-automation/music-video-renderer";
import { renderOriginalMascotLearningVideo } from "@/features/twitter-automation/original-mascot-learning-video-renderer";
import type { OriginalMascotLearningVideoMode, OriginalMascotLearningVideoPayload } from "@/features/twitter-automation/original-mascot-learning-video";
import { automationScopeSearchParams, type AutomationScope } from "@/features/twitter-automation/automation-scope";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";

type AutomationOutputStatus = "queued" | "processing" | "generating_video" | "awaiting_browser_image" | "awaiting_browser_video" | "ready_to_schedule" | "scheduled" | "failed";

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
  caption: string | null;
  mediaUrl: string | null;
  mediaUrls?: string[];
  media_type: "image" | "video" | null;
  error_code: string | null;
};

type LoadState = "loading" | "ready" | "error";

const FLOW_REFRESH_ERROR_MESSAGE = "İçerik üretim akışı yenilenemedi.";

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

function getOutputLabel(output: AutomationOutput) {
  if (GENERATOR_LABELS[output.generator]) return GENERATOR_LABELS[output.generator];
  return output.generator.replace(/^music-/u, "Müzikli ").replaceAll("-", " ");
}

function isConfusedWordsVideo(output: AutomationOutput) {
  return output.generator === "confused-words-video";
}

function isDialogueVideo(output: AutomationOutput) {
  return output.generator === "marketing-dialogue-video" || output.generator === "learning-dialogue-video";
}

function isOriginalMascotLearningVideo(output: AutomationOutput): output is AutomationOutput & { generator: OriginalMascotLearningVideoMode } {
  return output.generator === "tier-progression-video" || output.generator === "vocabulary-quiz-video" || output.generator === "sentence-check-video" || output.generator === "sentence-translation-video";
}

function isBrowserRenderedImage(output: AutomationOutput): output is AutomationOutput & AutomationBrowserImageOutput {
  const sourceGenerator = output.generator.startsWith("music-") ? output.generator.slice("music-".length) : output.generator;
  return output.status === "awaiting_browser_video" && output.media_type === null && output.tier !== "random" && BROWSER_IMAGE_GENERATORS.has(sourceGenerator);
}

function isGenerationComplete(output: AutomationOutput) {
  return output.status === "ready_to_schedule" || output.status === "scheduled" || output.status === "failed";
}

function isReadyForSchedule(output: AutomationOutput) {
  return output.status === "ready_to_schedule";
}

function needsGeneration(output: AutomationOutput) {
  return !isGenerationComplete(output);
}

function browserVideoFailureCode(error: unknown) {
  if (error instanceof Error && /^[a-z\d_]{3,120}$/iu.test(error.message)) return error.message;
  return "browser_video_render_failed";
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

function MediaStatusHint({ errorCode, pendingMessage }: { errorCode: string | null; pendingMessage?: string }) {
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
    </div>
  </div>;
}

export function GeneratedPostsTable({ runId, onClose, scope = "production" }: { runId: string; onClose: () => void; scope?: AutomationScope }) {
  const isTestAutomation = scope === "test";
  const scopeSearchParams = automationScopeSearchParams(scope);
  const [outputs, setOutputs] = useState<AutomationOutput[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [processingOutputId, setProcessingOutputId] = useState<string | null>(null);
  const [processingStartedAt, setProcessingStartedAt] = useState<number | null>(null);
  const [isSchedulingAll, setIsSchedulingAll] = useState(false);
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [isInterruptedReview, setIsInterruptedReview] = useState(false);
  const [retryingOutputId, setRetryingOutputId] = useState<string | null>(null);
  const autoStartedBrowserVideoIds = useRef(new Set<string>());

  const load = useCallback(async (showLoading = false): Promise<AutomationOutput[] | null> => {
    if (showLoading) setState("loading");
    try {
      const response = await fetch(`/api/twitter-automation/automation-runs?runId=${encodeURIComponent(runId)}${scopeSearchParams ? "&scope=test" : ""}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { outputs?: AutomationOutput[]; errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_runs_unavailable");
      const nextOutputs = Array.isArray(payload?.outputs) ? payload.outputs : [];
      setOutputs(nextOutputs);
      setState("ready");
      return nextOutputs;
    } catch {
      setState("error");
      setMessage(FLOW_REFRESH_ERROR_MESSAGE);
      return null;
    }
  }, [runId, scopeSearchParams]);

  const browserImageOutputs = useMemo(() => outputs.filter(isBrowserRenderedImage), [outputs]);
  const browserVideoOutputs = useMemo(() => outputs.filter((output) => output.status === "awaiting_browser_video" && !isBrowserRenderedImage(output)), [outputs]);
  const browserImageOutput = browserImageOutputs[0] ?? null;
  const nextOutput = useMemo(() => {
    if (browserImageOutputs.length || browserVideoOutputs.length) return null;
    return outputs.find((output) => output.status === "queued" || output.status === "generating_video") ?? null;
  }, [browserImageOutputs.length, browserVideoOutputs.length, outputs]);
  const completeCount = useMemo(() => outputs.filter(isGenerationComplete).length, [outputs]);
  const readyOutputs = useMemo(() => outputs.filter(isReadyForSchedule), [outputs]);
  const failedOutputs = useMemo(() => outputs.filter((output) => output.status === "failed"), [outputs]);
  const unverifiedOutputs = useMemo(() => isInterruptedReview ? outputs.filter(needsGeneration) : [], [isInterruptedReview, outputs]);
  const progress = outputs.length ? Math.round((completeCount / outputs.length) * 100) : 0;
  const isReviewReady = state === "ready" && outputs.length > 0 && !nextOutput && !browserImageOutputs.length && !browserVideoOutputs.length && !processingOutputId;
  const isResultScreen = isReviewReady || isInterruptedReview;
  const activeOutput = processingOutputId ? outputs.find((output) => output.id === processingOutputId) ?? null : browserImageOutputs[0] ?? nextOutput;
  const estimatedSecondsRemaining = useMemo(() => estimateRemainingGenerationSeconds({
    activeElapsedSeconds: processingOutputId && processingStartedAt ? Math.max(0, (now - processingStartedAt) / 1_000) : 0,
    activeOutputId: processingOutputId,
    outputs: outputs.map((output) => ({ contentType: output.content_type, generator: output.generator, id: output.id, status: output.status })),
  }), [now, outputs, processingOutputId, processingStartedAt]);

  const processNext = useCallback(async () => {
    if (!nextOutput || processingOutputId) return;
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
  }, [load, nextOutput, processingOutputId, scope]);

  const beginBrowserImageRender = useCallback((outputId: string) => {
    setProcessingOutputId(outputId);
    setProcessingStartedAt(Date.now());
    setMessage("");
  }, []);

  const completeBrowserImageRender = useCallback(async (output: AutomationOutput, result: { caption: string; imageDataUrls: string[] }) => {
    try {
      const stagedMediaPaths = await Promise.all(result.imageDataUrls.map(async (dataUrl, index) => {
        const imageResponse = await fetch(dataUrl);
        const blob = await imageResponse.blob();
        return stageBrowserImage(blob, output.id, index);
      }));
      const response = await fetch("/api/twitter-automation/automation-runs/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputId: output.id, stagedMediaPaths: stagedMediaPaths.map((item) => item.path), caption: result.caption, scope }),
      });
      const payload = await response.json().catch(() => null) as { errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_processing_failed");
    } catch {
      setMessage("Studio görseli kaydedilemedi. Sayfayı yenileyip tekrar deneyebilirsin.");
    } finally {
      await load();
      setProcessingOutputId(null);
      setProcessingStartedAt(null);
    }
  }, [load, scope]);

  const failBrowserImageRender = useCallback(async (output: AutomationOutput) => {
    setMessage("Studio görseli renderlanamadı. Review ekranında hata ayrıntısını göreceksin.");
    try {
      await fetch("/api/twitter-automation/automation-runs/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputId: output.id, browserImageError: "browser_image_render_failed", scope }),
      });
    } finally {
      await load();
      setProcessingOutputId(null);
      setProcessingStartedAt(null);
    }
  }, [load, scope]);

  const handleBrowserImageStart = useCallback(() => {
    if (browserImageOutput) beginBrowserImageRender(browserImageOutput.id);
  }, [beginBrowserImageRender, browserImageOutput]);

  const handleBrowserImageComplete = useCallback((result: { caption: string; imageDataUrls: string[] }) => {
    if (browserImageOutput) void completeBrowserImageRender(browserImageOutput, result);
  }, [browserImageOutput, completeBrowserImageRender]);

  const handleBrowserImageError = useCallback(() => {
    if (browserImageOutput) void failBrowserImageRender(browserImageOutput);
  }, [browserImageOutput, failBrowserImageRender]);

  const renderBrowserVideo = useCallback(async (output: AutomationOutput) => {
    const isConfusedWords = isConfusedWordsVideo(output);
    const isDialogue = isDialogueVideo(output);
    const isOriginalLearning = isOriginalMascotLearningVideo(output);
    if ((!output.mediaUrl && !isConfusedWords && !isDialogue && !isOriginalLearning) || processingOutputId || output.tier === "random") return;
    setProcessingOutputId(output.id);
    setProcessingStartedAt(Date.now());
    setMessage("");
    let audioContext: AudioContext | null = null;
    try {
      audioContext = await prepareMusicVideoAudio();
      let blob: Blob;
      let caption: string | undefined;
      if (isConfusedWords) {
        const planResponse = await fetch("/api/twitter-automation/confused-words-video", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ language: output.language, nativeLanguage: output.native_language, tier: output.tier }),
        });
        const plan = await planResponse.json().catch(() => null) as {
          caption?: string;
          phases?: Array<{
            first?: { term: string; tier: Exclude<AutomationOutput["tier"], "random"> };
            second?: { term: string; tier: Exclude<AutomationOutput["tier"], "random"> };
          }>;
          scenes?: ConfusedWordsVideoScene[];
          errorCode?: string;
        } | null;
        if (!planResponse.ok || !plan?.caption || !Array.isArray(plan.phases) || plan.phases.length !== 3 || plan.phases.some((phase) => !phase.first || !phase.second) || !Array.isArray(plan.scenes)) {
          throw new Error(plan?.errorCode ?? "confused_words_video_prepare_failed");
        }
        blob = await renderConfusedWordsVideo({
          audioContext,
          phases: plan.phases.map((phase) => ({ first: phase.first!, second: phase.second! })),
          scenes: plan.scenes,
        });
        caption = plan.caption;
      } else if (isDialogue) {
        const planResponse = await fetch("/api/twitter-automation/dialogue-video", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: output.generator, language: output.language, nativeLanguage: output.native_language }),
        });
        const plan = await planResponse.json().catch(() => null) as {
          caption?: string;
          backgroundVideoUrl?: string;
          backgroundVideoPath?: string;
          firstCharacter?: string;
          secondCharacter?: string;
          scenes?: DialogueVideoScene[];
          errorCode?: string;
        } | null;
        if (!planResponse.ok || !plan?.caption || !plan.backgroundVideoUrl || !plan.firstCharacter || !plan.secondCharacter || !Array.isArray(plan.scenes) || !plan.scenes.length) {
          throw new Error(plan?.errorCode ?? "dialogue_video_prepare_failed");
        }
        blob = await renderDialogueVideo({
          audioContext,
          backgroundVideoUrl: plan.backgroundVideoUrl,
          backgroundVideoPath: plan.backgroundVideoPath,
          firstCharacter: plan.firstCharacter,
          secondCharacter: plan.secondCharacter,
          scenes: plan.scenes,
        });
        caption = plan.caption;
      } else if (isOriginalLearning) {
        const planResponse = await fetch("/api/twitter-automation/original-mascot-learning-video", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: output.generator, language: output.language, nativeLanguage: output.native_language }),
        });
        const plan = await planResponse.json().catch(() => null) as (OriginalMascotLearningVideoPayload & { errorCode?: string }) | null;
        if (!planResponse.ok || !plan?.caption || !Array.isArray(plan.scenes) || !plan.scenes.length || plan.mode !== output.generator) {
          throw new Error(plan?.errorCode ?? "original_mascot_learning_video_prepare_failed");
        }
        blob = await renderOriginalMascotLearningVideo({ audioContext, scenes: plan.scenes, language: output.language as LanguageCode, nativeLanguage: output.native_language as LanguageCode });
        caption = plan.caption;
      } else {
        const tracks = ["/social-audio/music1.mp3", "/social-audio/music2.mp3", "/social-audio/music3.mp3", "/social-audio/music4.mp3", "/social-audio/music5.mp3", "/social-audio/music6.mp3", "/social-audio/music7.mp3"];
        const musicUrl = tracks[Math.floor(Math.random() * tracks.length)]!;
        blob = await renderMusicVideo({ audioContext, imageUrl: output.mediaUrl!, musicUrl });
      }
      audioContext = null;
      const staged = await stageBrowserVideo(blob, "automation-video", output.id);
      const response = await fetch("/api/twitter-automation/automation-runs/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputId: output.id, stagedMediaPath: staged.path, ...(caption ? { caption } : {}), scope }),
      });
      const payload = await response.json().catch(() => null) as { errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_processing_failed");
    } catch (error) {
      const errorCode = browserVideoFailureCode(error);
      try {
        const failureResponse = await fetch("/api/twitter-automation/automation-runs/process", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outputId: output.id, browserVideoError: errorCode, scope }),
        });
        if (!failureResponse.ok) throw new Error("automation_video_failure_update_failed");
        setMessage(`${getOutputLabel(output)} sesli olarak renderlanamadı; kuyruk sonraki içerikle devam ediyor.`);
      } catch {
        setMessage(`${getOutputLabel(output)} renderlanamadı ve hata durumu kaydedilemedi.`);
      }
    } finally {
      if (audioContext && audioContext.state !== "closed") await audioContext.close();
      await load();
      setProcessingOutputId(null);
      setProcessingStartedAt(null);
    }
  }, [load, processingOutputId, scope]);

  const scheduleAll = useCallback(async () => {
    if (isTestAutomation || !readyOutputs.length || isSchedulingAll || processingOutputId) return;
    setIsSchedulingAll(true);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, scope }),
      });
      const payload = await response.json().catch(() => null) as { scheduled?: number; failed?: number; errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_schedule_failed");
      setMessage(payload?.failed ? `${payload.scheduled ?? 0} içerik schedule edildi; ${payload.failed} içerik schedule edilemedi.` : `${payload?.scheduled ?? 0} içerik belirlenen tarih ve saatlere schedule edildi.`);
    } catch {
      setMessage("İçerikler schedule edilemedi. Review ekranındaki içerikler korunuyor; tekrar deneyebilirsin.");
    } finally {
      await load();
      setIsSchedulingAll(false);
    }
  }, [isSchedulingAll, isTestAutomation, load, processingOutputId, readyOutputs.length, runId, scope]);

  const resumeAutomation = useCallback(async () => {
    if (processingOutputId || retryingOutputId) return;
    setMessage("");
    const refreshedOutputs = await load(true);
    if (!refreshedOutputs) return;
    setIsInterruptedReview(false);
    if (refreshedOutputs.some(needsGeneration)) setMessage("Bağlantı geri geldi. Üretim kuyruğu kaldığı yerden devam ediyor.");
  }, [load, processingOutputId, retryingOutputId]);

  const retryOutput = useCallback(async (output: AutomationOutput) => {
    if (processingOutputId || retryingOutputId) return;
    if (output.status !== "failed") {
      await resumeAutomation();
      return;
    }

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
  }, [processingOutputId, resumeAutomation, retryingOutputId, scope]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(true), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!nextOutput || processingOutputId || state !== "ready") return;
    const delay = nextOutput.status === "generating_video" ? 8_000 : 500;
    const timer = window.setTimeout(() => void processNext(), delay);
    return () => window.clearTimeout(timer);
  }, [nextOutput, processNext, processingOutputId, state]);

  useEffect(() => {
    if (!nextOutput || processingOutputId || state !== "ready" || isInterruptedReview) return;
    const timer = window.setInterval(() => void load(), nextOutput.status === "generating_video" ? 8_000 : 1_500);
    return () => window.clearInterval(timer);
  }, [isInterruptedReview, load, nextOutput, processingOutputId, state]);

  useEffect(() => {
    if (state !== "ready" || processingOutputId || isInterruptedReview) return;
    const nextBrowserVideo = browserVideoOutputs.find((output) => !autoStartedBrowserVideoIds.current.has(output.id));
    if (!nextBrowserVideo) return;

    autoStartedBrowserVideoIds.current.add(nextBrowserVideo.id);
    const timer = window.setTimeout(() => void renderBrowserVideo(nextBrowserVideo), 0);
    return () => window.clearTimeout(timer);
  }, [browserVideoOutputs, isInterruptedReview, processingOutputId, renderBrowserVideo, state]);

  useEffect(() => {
    if (isReviewReady) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [isReviewReady]);

  const progressStatus = browserVideoOutputs.length
    ? "Sesli videolar sırayla renderlanıyor"
    : activeOutput
      ? generationStatusText(activeOutput, Boolean(processingOutputId))
      : state === "loading"
        ? "İçerik sırası hazırlanıyor"
        : "İçerikler hazırlanıyor";

  return <section aria-live="polite" className="flex max-h-[calc(100dvh-2rem)] w-[min(70rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-white/15 bg-[#171a19] text-[#f7f3ed] shadow-sm">
    {state === "ready" && !isInterruptedReview && browserImageOutput ? <AutomationBrowserImageRenderer
      key={browserImageOutput.id}
      onComplete={handleBrowserImageComplete}
      onError={handleBrowserImageError}
      onStart={handleBrowserImageStart}
      output={browserImageOutput}
    /> : null}
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
      <div className="min-w-0"><p className="truncate text-sm font-semibold">{isResultScreen ? "Üretilen içerikler" : "İçerikler hazırlanıyor"}</p><p className="truncate text-xs text-[#8d9b92]">{outputs.length} içerik · {completeCount} tamamlandı</p></div>
      <div className="flex items-center gap-2"><Button aria-label="İçerik durumunu yenile" className="size-8 rounded border-transparent bg-white/[0.06] p-0 text-[#d7e2da] hover:bg-white/[0.12]" disabled={state === "loading" || Boolean(processingOutputId) || isSchedulingAll} onClick={() => void load(true)} type="button"><RefreshCw className={cn("size-3.5", state === "loading" && "animate-spin")} /></Button><Button className="h-8 rounded border-white/10 bg-white/[0.06] px-3 text-xs text-[#d7e2da] hover:bg-white/[0.12]" disabled={Boolean(processingOutputId) || isSchedulingAll || (state === "ready" && !isReviewReady)} onClick={onClose} type="button"><X className="size-3.5" />Kapat</Button></div>
    </header>

    {!isResultScreen ? <main className="grid min-h-[27rem] place-items-center p-6 text-center">
      <div className="w-full max-w-xl">
        {browserVideoOutputs.length ? <Video className="mx-auto size-8 text-[#c7f05d]" /> : browserImageOutputs.length ? <ImageIcon className="mx-auto size-8 animate-pulse text-[#c7f05d]" /> : <LoaderCircle className="mx-auto size-8 animate-spin text-[#c7f05d]" />}
        <h2 className="mt-4 font-display text-3xl font-semibold">{browserVideoOutputs.length ? "Sesli videolar renderlanıyor" : browserImageOutputs.length ? "Studio görseli renderlanıyor" : "İçerikler sırayla üretiliyor"}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#a9b8ae]">{browserVideoOutputs.length ? `${browserVideoOutputs.length} video kaynağı hazır. Ses ekleme otomatik olarak devam ediyor; hata alan içerik işaretlenip kuyruk korunur.` : browserImageOutputs.length ? "Bu görsel, Social Content Studio ile aynı tasarım bileşenlerinden hazırlanıyor." : progressStatus}</p>
        <div className="relative mt-7 h-5 overflow-hidden rounded bg-[#0f1411]"><div className="h-full rounded bg-[#c7f05d] transition-[width] duration-500" style={{ width: `${progress}%` }} />{isTestAutomation ? <span className="absolute inset-0 grid place-items-center text-[10px] font-bold tracking-[0.25em] text-white">TEST</span> : null}</div>
        <div className="mt-3 flex items-center justify-between text-xs text-[#829287]"><span>{completeCount} / {outputs.length || "…"} hazır</span><span>{progress}%</span></div>
        <p className="mt-2 text-xs text-[#a9b8ae]">{`Tahmini kalan süre: ${formatEstimatedDuration(estimatedSecondsRemaining)}`}</p>
        {message ? <p className="mt-5 text-sm text-[#ffb9c1]">{message}</p> : null}
        {state === "error" ? <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button className="h-9 border border-[#f1c75b]/50 bg-[#312816] px-3 text-xs text-[#ffe7a0] hover:bg-[#40351e]" onClick={() => setIsInterruptedReview(true)} type="button">Sonuç ekranına git</Button>
          <Button className="h-9 bg-[#c7f05d] px-3 text-xs text-[#152006] hover:bg-[#d7fa78]" disabled={Boolean(retryingOutputId)} onClick={() => void resumeAutomation()} type="button"><RefreshCw className="size-3.5" />Devam etmeye çalış</Button>
        </div> : null}
      </div>
    </main> : <main className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4"><div><p className="text-sm font-semibold text-[#f7f3ed]">{isInterruptedReview ? "Üretim durumu beklemede" : "Gönderime hazır içerikler"}</p><p className="mt-1 text-xs text-[#8d9b92]">{isInterruptedReview ? "Sarı içeriklerin üretim durumu doğrulanamadı. Her birini yeniden deneyebilir veya akışı devam ettirebilirsin." : "Aşağıdaki saatler İstanbul saatidir. Schedule all demeden hiçbir içerik paylaşım servisine gönderilmez."}</p></div><div className="flex items-center gap-3">{unverifiedOutputs.length ? <p className="text-xs text-[#f1d77c]">{unverifiedOutputs.length} içerik beklemede</p> : null}{failedOutputs.length ? <p className="text-xs text-[#ffb9c1]">{failedOutputs.length} içerik üretilemedi</p> : null}</div></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{outputs.map((output) => {
        const ready = isReadyForSchedule(output);
        const scheduled = output.status === "scheduled";
        const isPendingVerification = isInterruptedReview && needsGeneration(output);
        const canRetry = output.status === "failed" || isPendingVerification;
        return <article className={cn("overflow-hidden rounded border p-3", ready ? "border-[#2b634a] bg-[#11251c]" : scheduled ? "border-[#29435d] bg-[#101d28]" : isPendingVerification ? "border-[#b68e2c] bg-[#322916]" : "border-[#61352e] bg-[#2c1917]")} key={output.id}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{output.group_name}</p><p className="mt-1 truncate text-[11px] text-[#a9b8ae]">{getOutputLabel(output)}</p></div>{ready || scheduled ? <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#a9ecc8]"><Check aria-label="İçerik başarılı" className="size-4" />Başarılı</div> : isPendingVerification ? <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#f1d77c]"><CircleAlert aria-label="İçerik beklemede" className="size-4" />Beklemede</div> : <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#ffb9c1]"><CircleAlert aria-label="İçerik üretilemedi" className="size-4" />Hatalı</div>}</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-[#d7e2da]"><CalendarClock className="size-3.5 shrink-0 text-[#c7f05d]" /><span>{scheduled ? "Schedule edildi:" : "Schedule zamanı:"} {formatScheduledAt(output.scheduled_at)}</span></div>
          <div className="relative mt-3">
            {output.mediaUrls?.length ? <div className="grid grid-cols-3 gap-1 overflow-hidden rounded border border-white/10 bg-black p-1">{output.mediaUrls.map((mediaUrl, index) => <div className="relative aspect-[3/4] overflow-hidden rounded-sm" key={mediaUrl}><Image alt={`${output.group_name} görseli ${index + 1}`} className="object-cover" fill sizes="(min-width: 1280px) 7rem, (min-width: 768px) 9vw, 28vw" src={mediaUrl} unoptimized /></div>)}</div> : output.mediaUrl ? <div className="overflow-hidden rounded border border-white/10 bg-black">{output.media_type === "video" ? <video className="aspect-video w-full object-contain" controls src={output.mediaUrl} /> : <div className="relative aspect-square"><Image alt={`${output.group_name} üretilen içerik`} className="object-contain" fill sizes="(min-width: 1280px) 22rem, (min-width: 768px) 30vw, 90vw" src={output.mediaUrl} unoptimized /></div>}</div> : output.content_type === "text" ? <div className="flex min-h-28 items-start gap-2 rounded border border-white/10 bg-black/10 p-3 text-xs leading-5 text-[#d7e2da]"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-[#c7f05d]" /><p>{output.caption ?? "Metin içeriği hazırlanamadı."}</p></div> : <div className="grid aspect-square place-items-center rounded border border-dashed border-white/10 bg-black/10 text-[#718077]">{output.content_type === "video" ? <Video className="size-6" /> : <ImageIcon className="size-6" />}</div>}
            <MediaStatusHint errorCode={output.error_code} pendingMessage={isPendingVerification ? FLOW_REFRESH_ERROR_MESSAGE : undefined} />
          </div>
          {canRetry ? <Button className={cn("mt-3 h-8 w-full px-3 text-xs", isPendingVerification ? "border border-[#f1c75b]/50 bg-[#312816] text-[#ffe7a0] hover:bg-[#40351e]" : "border border-[#ffb9c1]/45 bg-[#3b211e] text-[#ffd9de] hover:bg-[#4a2822]")} disabled={Boolean(processingOutputId) || Boolean(retryingOutputId)} onClick={() => void retryOutput(output)} type="button">{retryingOutputId === output.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}{isPendingVerification ? "Yeniden dene" : "Yeniden üret"}</Button> : null}
        </article>;
      })}</div>
    </main>}

    {isResultScreen ? <footer className="flex shrink-0 flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#829287]">{isInterruptedReview ? FLOW_REFRESH_ERROR_MESSAGE : isTestAutomation ? "TEST modu: üretilen içerikler production'a schedule edilemez." : message || (readyOutputs.length ? `${readyOutputs.length} içerik schedule onayını bekliyor.` : "Schedule edilecek hazır içerik kalmadı.")}</p><div className="flex flex-wrap gap-2">{isInterruptedReview ? <Button className="h-10 border border-white/15 bg-white/[0.06] px-3 text-xs text-[#d7e2da] hover:bg-white/[0.12]" disabled={Boolean(processingOutputId) || Boolean(retryingOutputId)} onClick={() => void resumeAutomation()} type="button"><RefreshCw className="size-3.5" />Devam etmeye çalış</Button> : null}<Button className="h-10 bg-[#c7f05d] px-4 text-sm text-[#152006] hover:bg-[#d7fa78] disabled:cursor-not-allowed disabled:opacity-45" disabled={isInterruptedReview || state !== "ready" || isTestAutomation || !readyOutputs.length || isSchedulingAll || Boolean(processingOutputId)} onClick={() => void scheduleAll()} title={isInterruptedReview ? "Önce bekleyen içeriklerin durumunu doğrula" : isTestAutomation ? "TEST modunda production scheduling kapalıdır" : undefined} type="button">{isTestAutomation ? <CalendarClock className="size-4" /> : isSchedulingAll ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}{isTestAutomation ? "Schedule all kilitli (TEST)" : `Schedule all (${readyOutputs.length})`}</Button></div></footer> : <footer className="flex min-h-10 shrink-0 items-center border-t border-white/10 px-4 text-xs text-[#829287]">{message || progressStatus}</footer>}
  </section>;
}
