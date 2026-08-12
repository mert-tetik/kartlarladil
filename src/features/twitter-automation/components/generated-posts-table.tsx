"use client";

import { CalendarClock, Check, CircleAlert, ImageIcon, LoaderCircle, MessageSquareText, RefreshCw, Video, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { stageBrowserVideo } from "@/features/twitter-automation/browser-media-stage";
import { renderConfusedWordsVideo, type ConfusedWordsVideoScene } from "@/features/twitter-automation/confused-words-video-renderer";
import { prepareMusicVideoAudio, renderMusicVideo } from "@/features/twitter-automation/music-video-renderer";
import { cn } from "@/lib/utils";

type AutomationOutputStatus = "queued" | "processing" | "generating_video" | "awaiting_browser_video" | "ready_to_schedule" | "scheduled" | "failed";

type AutomationOutput = {
  id: string;
  day_offset: number;
  group_name: string;
  content_type: string;
  generator: string;
  language: string;
  native_language: string;
  tier: "A1" | "A2" | "B1" | "B2" | "C1" | "random";
  scheduled_at: string;
  status: AutomationOutputStatus;
  caption: string | null;
  mediaUrl: string | null;
  media_type: "image" | "video" | null;
  error_code: string | null;
};

type LoadState = "loading" | "ready" | "error";

const GENERATOR_LABELS: Record<string, string> = {
  "ai-word-of-the-day": "AI Word of the Day görseli",
  "ai-mini-quiz": "AI Mini Quiz görseli",
  "ai-false-friends": "AI False Friends görseli",
  "ai-daily-challenge": "AI Daily Challenge görseli",
  "ai-vocabulary-progression": "AI Beginner to Advanced görseli",
  "ai-example-sentences": "AI Example Sentences görseli",
  "word-of-the-day": "Word of the Day görseli",
  "word-of-the-day-poster": "Word of the Day posteri",
  "ai-word-of-the-day-video": "Word of the Day videosu",
  "confused-words-video": "Confused Words videosu",
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

function isGenerationComplete(output: AutomationOutput) {
  return output.status === "ready_to_schedule" || output.status === "scheduled" || output.status === "failed";
}

function isReadyForSchedule(output: AutomationOutput) {
  return output.status === "ready_to_schedule";
}

function generationStatusText(output: AutomationOutput, isProcessing: boolean) {
  if (isProcessing || output.status === "processing") return `${getOutputLabel(output)} üretiliyor`;
  if (output.status === "generating_video") return `${getOutputLabel(output)} renderlanıyor`;
  if (output.status === "awaiting_browser_video") return `${getOutputLabel(output)} için ses ekleme onayı bekleniyor`;
  if (output.status === "ready_to_schedule") return `${getOutputLabel(output)} hazır`;
  if (output.status === "scheduled") return `${getOutputLabel(output)} schedule edildi`;
  if (output.status === "failed") return `${getOutputLabel(output)} üretilemedi`;
  return `${getOutputLabel(output)} üretim sırasını bekliyor`;
}

export function GeneratedPostsTable({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [outputs, setOutputs] = useState<AutomationOutput[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [processingOutputId, setProcessingOutputId] = useState<string | null>(null);
  const [isSchedulingAll, setIsSchedulingAll] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setState("loading");
    try {
      const response = await fetch(`/api/twitter-automation/automation-runs?runId=${encodeURIComponent(runId)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { outputs?: AutomationOutput[]; errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_runs_unavailable");
      setOutputs(Array.isArray(payload?.outputs) ? payload.outputs : []);
      setState("ready");
    } catch {
      setState("error");
      setMessage("İçerik üretim akışı yenilenemedi.");
    }
  }, [runId]);

  const browserVideoOutputs = useMemo(() => outputs.filter((output) => output.status === "awaiting_browser_video"), [outputs]);
  const nextOutput = useMemo(() => {
    if (browserVideoOutputs.length) return null;
    return outputs.find((output) => output.status === "queued" || output.status === "generating_video") ?? null;
  }, [browserVideoOutputs.length, outputs]);
  const completeCount = useMemo(() => outputs.filter(isGenerationComplete).length, [outputs]);
  const readyOutputs = useMemo(() => outputs.filter(isReadyForSchedule), [outputs]);
  const failedOutputs = useMemo(() => outputs.filter((output) => output.status === "failed"), [outputs]);
  const progress = outputs.length ? Math.round((completeCount / outputs.length) * 100) : 0;
  const isReviewReady = state === "ready" && outputs.length > 0 && !nextOutput && !browserVideoOutputs.length && !processingOutputId;
  const activeOutput = processingOutputId ? outputs.find((output) => output.id === processingOutputId) ?? null : nextOutput;

  const processNext = useCallback(async () => {
    if (!nextOutput || processingOutputId) return;
    setProcessingOutputId(nextOutput.id);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outputId: nextOutput.id }),
      });
      const payload = await response.json().catch(() => null) as { outcome?: string; errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_processing_failed");
      if (payload?.outcome === "video_pending") setMessage("Video sağlayıcısının renderı bitirmesi bekleniyor.");
    } catch {
      setMessage("Bir içerik üretilemedi. Review ekranında hata ayrıntısını göreceksin.");
    } finally {
      await load();
      setProcessingOutputId(null);
    }
  }, [load, nextOutput, processingOutputId]);

  const renderBrowserVideo = useCallback(async (output: AutomationOutput) => {
    const isConfusedWords = isConfusedWordsVideo(output);
    if ((!output.mediaUrl && !isConfusedWords) || processingOutputId || output.tier === "random") return;
    setProcessingOutputId(output.id);
    setMessage("");
    let audioContext: AudioContext | null = null;
    try {
      // This is deliberately created from the explicit continuation click. Browsers require it before recording audio tracks.
      audioContext = prepareMusicVideoAudio();
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
        body: JSON.stringify({ outputId: output.id, stagedMediaPath: staged.path, ...(caption ? { caption } : {}) }),
      });
      const payload = await response.json().catch(() => null) as { errorCode?: string } | null;
      if (!response.ok) throw new Error(payload?.errorCode ?? "automation_processing_failed");
    } catch {
      setMessage(isConfusedWords ? "Açıklama videosuna ses eklenemedi. Chrome’da tekrar dene." : "Müzikli videoya ses eklenemedi. Chrome’da tekrar dene.");
    } finally {
      if (audioContext && audioContext.state !== "closed") await audioContext.close();
      await load();
      setProcessingOutputId(null);
    }
  }, [load, processingOutputId]);

  const scheduleAll = useCallback(async () => {
    if (!readyOutputs.length || isSchedulingAll || processingOutputId) return;
    setIsSchedulingAll(true);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/automation-runs/schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId }),
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
  }, [isSchedulingAll, load, processingOutputId, readyOutputs.length, runId]);

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
    if (!nextOutput || processingOutputId) return;
    const timer = window.setInterval(() => void load(), nextOutput.status === "generating_video" ? 8_000 : 1_500);
    return () => window.clearInterval(timer);
  }, [load, nextOutput, processingOutputId]);

  const progressStatus = browserVideoOutputs.length
    ? "Ses eklemek için onay bekleniyor"
    : activeOutput
      ? generationStatusText(activeOutput, Boolean(processingOutputId))
      : state === "loading"
        ? "İçerik sırası hazırlanıyor"
        : "İçerikler hazırlanıyor";

  return <section aria-live="polite" className="flex max-h-[calc(100dvh-2rem)] w-[min(70rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-white/15 bg-[#171a19] text-[#f7f3ed] shadow-sm">
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
      <div className="min-w-0"><p className="truncate text-sm font-semibold">{isReviewReady ? "Üretilen içerikler" : "İçerikler hazırlanıyor"}</p><p className="truncate text-xs text-[#8d9b92]">{outputs.length} içerik · {completeCount} tamamlandı</p></div>
      <div className="flex items-center gap-2"><Button aria-label="İçerik durumunu yenile" className="size-8 rounded border-transparent bg-white/[0.06] p-0 text-[#d7e2da] hover:bg-white/[0.12]" disabled={state === "loading" || Boolean(processingOutputId) || isSchedulingAll} onClick={() => void load(true)} type="button"><RefreshCw className={cn("size-3.5", state === "loading" && "animate-spin")} /></Button><Button className="h-8 rounded border-white/10 bg-white/[0.06] px-3 text-xs text-[#d7e2da] hover:bg-white/[0.12]" disabled={Boolean(processingOutputId) || isSchedulingAll || (state === "ready" && !isReviewReady)} onClick={onClose} type="button"><X className="size-3.5" />Kapat</Button></div>
    </header>

    {!isReviewReady ? <main className="grid min-h-[27rem] place-items-center p-6 text-center">
      <div className="w-full max-w-xl">
        {browserVideoOutputs.length ? <Video className="mx-auto size-8 text-[#c7f05d]" /> : <LoaderCircle className="mx-auto size-8 animate-spin text-[#c7f05d]" />}
        <h2 className="mt-4 font-display text-3xl font-semibold">{browserVideoOutputs.length ? "Video sesi için devam et" : "İçerikler sırayla üretiliyor"}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#a9b8ae]">{browserVideoOutputs.length ? `${browserVideoOutputs.length} video kaynağı hazır. Tarayıcının sesli video kaydına izin vermesi için bu adımı sen başlatmalısın.` : progressStatus}</p>
        <div className="mt-7 h-2 overflow-hidden rounded bg-[#0f1411]"><div className="h-full rounded bg-[#c7f05d] transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
        <div className="mt-3 flex items-center justify-between text-xs text-[#829287]"><span>{completeCount} / {outputs.length || "…"} hazır</span><span>{progress}%</span></div>
        {browserVideoOutputs.length ? <Button className="mt-7 h-10 bg-[#c7f05d] px-4 text-sm text-[#152006] hover:bg-[#d7fa78]" disabled={Boolean(processingOutputId)} onClick={() => void renderBrowserVideo(browserVideoOutputs[0]!)} type="button">{processingOutputId ? <LoaderCircle className="size-4 animate-spin" /> : <Video className="size-4" />}{isConfusedWordsVideo(browserVideoOutputs[0]!) ? "Devam et ve açıklama videosunu renderla" : "Devam et ve videoya ses ekle"}</Button> : null}
        {message ? <p className="mt-5 text-sm text-[#ffb9c1]">{message}</p> : null}
      </div>
    </main> : <main className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4"><div><p className="text-sm font-semibold text-[#f7f3ed]">Gönderime hazır içerikler</p><p className="mt-1 text-xs text-[#8d9b92]">Aşağıdaki saatler İstanbul saatidir. Schedule all demeden hiçbir içerik paylaşım servisine gönderilmez.</p></div>{failedOutputs.length ? <p className="text-xs text-[#ffb9c1]">{failedOutputs.length} içerik üretilemedi</p> : null}</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{outputs.map((output) => {
        const ready = isReadyForSchedule(output);
        const scheduled = output.status === "scheduled";
        return <article className={cn("overflow-hidden rounded border p-3", ready ? "border-[#2b634a] bg-[#11251c]" : scheduled ? "border-[#29435d] bg-[#101d28]" : "border-[#61352e] bg-[#2c1917]")} key={output.id}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{output.group_name}</p><p className="mt-1 truncate text-[11px] text-[#a9b8ae]">{getOutputLabel(output)}</p></div>{ready || scheduled ? <Check aria-label="İçerik hazır" className="mt-0.5 size-5 shrink-0 text-[#a9ecc8]" /> : <CircleAlert aria-label="İçerik üretilemedi" className="mt-0.5 size-5 shrink-0 text-[#ffb9c1]" />}</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-[#d7e2da]"><CalendarClock className="size-3.5 shrink-0 text-[#c7f05d]" /><span>{scheduled ? "Schedule edildi:" : "Schedule zamanı:"} {formatScheduledAt(output.scheduled_at)}</span></div>
          {output.mediaUrl ? <div className="relative mt-3 overflow-hidden rounded border border-white/10 bg-black">{output.media_type === "video" ? <video className="aspect-video w-full object-contain" controls src={output.mediaUrl} /> : <div className="relative aspect-square"><Image alt={`${output.group_name} üretilen içerik`} className="object-contain" fill sizes="(min-width: 1280px) 22rem, (min-width: 768px) 30vw, 90vw" src={output.mediaUrl} unoptimized /></div>}</div> : output.content_type === "text" ? <div className="mt-3 flex min-h-28 items-start gap-2 rounded border border-white/10 bg-black/10 p-3 text-xs leading-5 text-[#d7e2da]"><MessageSquareText className="mt-0.5 size-4 shrink-0 text-[#c7f05d]" /><p>{output.caption ?? "Metin içeriği hazırlanamadı."}</p></div> : <div className="mt-3 grid aspect-square place-items-center rounded border border-dashed border-white/10 bg-black/10 text-[#718077]">{output.content_type === "video" ? <Video className="size-6" /> : <ImageIcon className="size-6" />}</div>}
          {output.error_code ? <p className="mt-3 break-words text-[11px] text-[#ffb9c1]">{output.error_code}</p> : null}
        </article>;
      })}</div>
    </main>}

    {isReviewReady ? <footer className="flex shrink-0 flex-col gap-3 border-t border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[#829287]">{message || (readyOutputs.length ? `${readyOutputs.length} içerik schedule onayını bekliyor.` : "Schedule edilecek hazır içerik kalmadı.")}</p><Button className="h-10 bg-[#c7f05d] px-4 text-sm text-[#152006] hover:bg-[#d7fa78]" disabled={!readyOutputs.length || isSchedulingAll || Boolean(processingOutputId)} onClick={() => void scheduleAll()} type="button">{isSchedulingAll ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarClock className="size-4" />}Schedule all ({readyOutputs.length})</Button></footer> : <footer className="flex min-h-10 shrink-0 items-center border-t border-white/10 px-4 text-xs text-[#829287]">{message || progressStatus}</footer>}
  </section>;
}
