"use client";

import { Check, CircleAlert, ImageIcon, LoaderCircle, MessageSquareText, RefreshCw, Video, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { stageBrowserVideo } from "@/features/twitter-automation/browser-media-stage";
import { renderConfusedWordsVideo, type ConfusedWordsVideoScene } from "@/features/twitter-automation/confused-words-video-renderer";
import { prepareMusicVideoAudio, renderMusicVideo } from "@/features/twitter-automation/music-video-renderer";
import { cn } from "@/lib/utils";

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
  status: "queued" | "processing" | "generating_video" | "awaiting_browser_video" | "scheduled" | "failed";
  caption: string | null;
  mediaUrl: string | null;
  media_type: "image" | "video" | null;
  error_code: string | null;
};

type LoadState = "loading" | "ready" | "error";

function formatScheduledAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(date);
}

function generationLabel(output: AutomationOutput, isProcessing: boolean) {
  if (isProcessing || output.status === "processing") return "Generating content…";
  if (output.status === "generating_video") return "Rendering video…";
  if (output.status === "awaiting_browser_video") return output.generator === "confused-words-video" ? "Speech scenes are ready — render the explainer video" : "Source image is ready — render the music video";
  if (output.status === "scheduled") return "Generated and scheduled";
  if (output.status === "failed") return "Generation failed";
  return "Waiting to generate";
}

function isGenerated(output: AutomationOutput) {
  return output.status === "scheduled";
}

function isConfusedWordsVideo(output: AutomationOutput) {
  return output.generator === "confused-words-video";
}

export function GeneratedPostsTable({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [outputs, setOutputs] = useState<AutomationOutput[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [processingOutputId, setProcessingOutputId] = useState<string | null>(null);
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
      setMessage("This schedule run could not be refreshed.");
    }
  }, [runId]);

  const nextOutput = useMemo(() => outputs.find((output) => output.status === "queued" || output.status === "generating_video") ?? null, [outputs]);

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
      if (payload?.outcome === "video_pending") setMessage("Video is still rendering. It will be checked again shortly.");
    } catch {
      setMessage("One media block could not be generated. Its error is shown on the block.");
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
      setMessage(isConfusedWords ? "The explainer video could not be rendered or uploaded. Try again in Chrome." : "The music video could not be rendered or uploaded. Try again in Chrome.");
    } finally {
      if (audioContext && audioContext.state !== "closed") await audioContext.close();
      await load();
      setProcessingOutputId(null);
    }
  }, [load, processingOutputId]);

  useEffect(() => { void load(true); }, [load]);

  useEffect(() => {
    if (!nextOutput || processingOutputId || state !== "ready") return;
    const delay = nextOutput.status === "generating_video" ? 8_000 : 500;
    const timer = window.setTimeout(() => void processNext(), delay);
    return () => window.clearTimeout(timer);
  }, [nextOutput?.id, nextOutput?.status, processNext, processingOutputId, state]);

  useEffect(() => {
    if (!nextOutput || processingOutputId) return;
    const timer = window.setInterval(() => void load(), nextOutput.status === "generating_video" ? 8_000 : 1_500);
    return () => window.clearInterval(timer);
  }, [load, nextOutput?.id, nextOutput?.status, processingOutputId]);

  return <section className="flex max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-white/15 bg-[#171a19] text-[#f7f3ed] shadow-sm">
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
      <div className="min-w-0"><p className="truncate text-sm font-semibold">Current schedule</p><p className="truncate text-xs text-[#8d9b92]">{outputs.length} media block{outputs.length === 1 ? "" : "s"}</p></div>
      <div className="flex items-center gap-2"><Button aria-label="Refresh current schedule" className="size-8 rounded border-transparent bg-white/[0.06] p-0 text-[#d7e2da] hover:bg-white/[0.12]" disabled={state === "loading" || Boolean(processingOutputId)} onClick={() => void load(true)} type="button"><RefreshCw className={cn("size-3.5", state === "loading" && "animate-spin")} /></Button><Button className="h-8 rounded border-white/10 bg-white/[0.06] px-3 text-xs text-[#d7e2da] hover:bg-white/[0.12]" onClick={onClose} type="button"><X className="size-3.5" />Close</Button></div>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <div className="grid gap-2 sm:grid-cols-2">{outputs.map((output) => {
        const active = processingOutputId === output.id || output.status === "processing" || output.status === "generating_video";
        const complete = isGenerated(output);
        const showMedia = (complete || output.status === "awaiting_browser_video") && Boolean(output.mediaUrl);
        return <article className={cn("overflow-hidden rounded border p-3", complete ? "border-[#2b634a] bg-[#11251c]" : output.status === "failed" ? "border-[#61352e] bg-[#2c1917]" : "border-white/10 bg-[#101212]")} key={output.id}>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{output.group_name}</p><p className="mt-1 truncate text-[11px] text-[#8d9b92]">Day {output.day_offset} · {output.generator}</p></div>{complete ? <span aria-label="Media generated" className="grid size-6 shrink-0 place-items-center rounded-full bg-[#55c39a] text-[#07130d]"><Check className="size-4" /></span> : active ? <LoaderCircle aria-label="Generating media" className="mt-0.5 size-5 shrink-0 animate-spin text-[#c7f05d]" /> : output.status === "failed" ? <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#ff9c8b]" /> : <span className="size-5 shrink-0 rounded-full border border-[#718077]" />}</div>
          <p className={cn("mt-3 text-xs", complete ? "text-[#a9ecc8]" : output.status === "failed" ? "text-[#ffb9c1]" : "text-[#a9b8ae]")}>{generationLabel(output, processingOutputId === output.id)}</p>
          <p className="mt-1 text-[11px] text-[#718077]">{formatScheduledAt(output.scheduled_at)}</p>
          {showMedia ? <div className="mt-3 overflow-hidden rounded border border-white/10 bg-black">{output.media_type === "video" ? <video className="aspect-[9/16] w-full object-cover" controls src={output.mediaUrl!} /> : <img alt={`${output.group_name} generated media`} className="aspect-square w-full object-cover" src={output.mediaUrl!} />}</div> : complete && output.content_type === "text" ? <div className="mt-3 flex min-h-24 items-center gap-2 rounded border border-white/10 bg-black/10 p-3 text-xs leading-5 text-[#d7e2da]"><MessageSquareText className="size-4 shrink-0 text-[#c7f05d]" />{output.caption ?? "Text post generated."}</div> : !complete ? <div className={cn("mt-3 grid place-items-center rounded border border-dashed border-white/10 bg-black/10 text-[#718077]", output.content_type === "video" ? "aspect-[9/16]" : "aspect-square")}>{output.content_type === "video" ? <Video className="size-6" /> : <ImageIcon className="size-6" />}</div> : null}
          {output.error_code ? <p className="mt-3 break-words text-[11px] text-[#ff9c8b]">{output.error_code}</p> : null}
          {output.status === "awaiting_browser_video" ? <Button className="mt-3 h-8 w-full bg-[#c7f05d] text-xs text-[#152006] hover:bg-[#d7fa78]" disabled={Boolean(processingOutputId) || (!output.mediaUrl && !isConfusedWordsVideo(output)) || output.tier === "random"} onClick={() => void renderBrowserVideo(output)} type="button">{processingOutputId === output.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Video className="size-3.5" />}{isConfusedWordsVideo(output) ? "Render confused words video" : "Render music video"}</Button> : null}
        </article>;
      })}</div>
      {state === "loading" && !outputs.length ? <div className="grid min-h-36 place-items-center text-sm text-[#8d9b92]"><LoaderCircle className="mr-2 inline size-4 animate-spin" />Preparing media blocks…</div> : null}
      {state === "ready" && !outputs.length ? <div className="grid min-h-36 place-items-center text-sm text-[#8d9b92]">No media blocks were created for this schedule.</div> : null}
    </div>
    <footer className="flex min-h-10 shrink-0 items-center border-t border-white/10 px-4 text-xs text-[#829287]">{message || (nextOutput ? "Media blocks update as each item is generated." : outputs.some((output) => output.status === "awaiting_browser_video") ? "Render the prepared music videos to complete their schedules." : "All media blocks have finished.")}</footer>
  </section>;
}
