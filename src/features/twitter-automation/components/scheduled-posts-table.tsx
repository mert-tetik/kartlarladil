"use client";

import { ArrowLeft, CalendarClock, CircleAlert, ImageOff, LoaderCircle, RefreshCw, Trash2, Video, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LoadingState = "loading" | "ready" | "error";
type UploadPostScheduledPost = {
  jobId: string;
  scheduledDate: string | null;
  postType: string | null;
  profileUsername: string | null;
  title: string | null;
  caption: string | null;
  previewUrl: string | null;
  platforms: string[];
  status: string | null;
};

function formatScheduledDate(value: string | null) {
  if (!value) return "No date returned";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(date);
}

function isVideo(post: UploadPostScheduledPost) {
  return post.postType?.toLocaleLowerCase() === "video";
}

function getErrorMessage(errorCode: string | undefined) {
  const messages: Record<string, string> = {
    upload_post_not_configured: "Set the server-only Upload-Post API key before managing scheduled posts.",
    upload_post_scheduled_posts_unavailable: "Upload-Post could not load scheduled posts.",
    upload_post_scheduled_post_cancel_failed: "Upload-Post could not cancel this scheduled post.",
    invalid_scheduled_post: "This scheduled post is invalid.",
  };
  return messages[errorCode ?? ""] ?? "Upload-Post could not complete this request.";
}

function MediaPreview({ post, onOpen }: { post: UploadPostScheduledPost; onOpen: () => void }) {
  if (!post.previewUrl) return <div className="grid size-16 place-items-center rounded border border-dashed border-white/15 text-[#718077]"><ImageOff className="size-4" aria-hidden="true" /></div>;

  return <button aria-label={`Open media preview for ${post.title ?? post.jobId}`} className="group relative size-16 overflow-hidden rounded border border-white/10 bg-[#0d0f0e]" onClick={onOpen} type="button">
    {isVideo(post) ? <video className="size-full object-cover" muted preload="metadata" src={post.previewUrl} /> : <img alt="Scheduled post media preview" className="size-full object-cover transition-transform duration-200 group-hover:scale-105" src={post.previewUrl} />}
    <span className="absolute inset-0 grid place-items-center bg-black/0 text-transparent transition-colors group-hover:bg-black/45 group-hover:text-white">{isVideo(post) ? <Video className="size-4" aria-hidden="true" /> : <span className="text-xs font-medium">View</span>}</span>
  </button>;
}

export function ScheduledPostsTable({ onBack }: { onBack: () => void }) {
  const [posts, setPosts] = useState<UploadPostScheduledPost[]>([]);
  const [state, setState] = useState<LoadingState>("loading");
  const [message, setMessage] = useState("");
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<UploadPostScheduledPost | null>(null);

  async function loadPosts() {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/scheduled-posts", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { posts?: UploadPostScheduledPost[]; errorCode?: string } | null;
      if (!response.ok) throw new Error(getErrorMessage(payload?.errorCode));
      setPosts(Array.isArray(payload?.posts) ? payload.posts : []);
      setState("ready");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Upload-Post could not load scheduled posts.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPosts(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!previewPost) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewPost(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewPost]);

  const scheduledPosts = useMemo(() => [...posts].sort((first, second) => (first.scheduledDate ?? "").localeCompare(second.scheduledDate ?? "")), [posts]);

  async function cancelPost(post: UploadPostScheduledPost) {
    if (!window.confirm(`Cancel the scheduled post “${post.title ?? post.jobId}”?`)) return;

    setCancellingJobId(post.jobId);
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/scheduled-posts", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId: post.jobId }),
      });
      const payload = await response.json().catch(() => null) as { errorCode?: string } | null;
      if (!response.ok) throw new Error(getErrorMessage(payload?.errorCode));
      setPosts((current) => current.filter((item) => item.jobId !== post.jobId));
      setMessage("Scheduled post cancelled in Upload-Post.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The scheduled post could not be cancelled.");
    } finally {
      setCancellingJobId(null);
    }
  }

  return <section className="content-automation-shell flex min-h-[calc(100dvh-4rem)] flex-col bg-[#101212] text-[#f7f3ed]">
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#171a19] px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><Button aria-label="Back to content studio" className="size-8 shrink-0 rounded border-white/10 bg-transparent p-0 text-[#d7e2da] hover:bg-white/[0.06]" onClick={onBack} type="button"><ArrowLeft className="size-4" /></Button><div className="min-w-0"><p className="truncate text-sm font-semibold">Scheduled Posts</p><p className="truncate text-xs text-[#8d9b92]">Upload-Post queue</p></div></div>
      <div className="flex items-center gap-2"><span className="hidden text-xs text-[#829287] sm:inline">{scheduledPosts.length} scheduled</span><Button aria-label="Refresh scheduled posts" className="size-8 rounded border-transparent bg-[#c7f05d] p-0 text-black hover:bg-[#d6ff73]" disabled={state === "loading"} onClick={() => void loadPosts()} type="button"><RefreshCw className={cn("size-3.5", state === "loading" && "animate-spin")} /></Button></div>
    </header>

    <div className="min-h-0 flex-1 overflow-auto">
      <table className="min-w-[1280px] w-full border-collapse text-left">
        <thead className="sticky top-0 z-20"><tr><th className="w-24 border-b border-r border-white/10 bg-[#171a19] px-3 py-2 text-xs font-semibold text-[#a9b8ae]">Media</th><th className="min-w-60 border-b border-r border-white/10 bg-[#171a19] px-3 py-2 text-xs font-semibold text-[#a9b8ae]">Post</th><th className="min-w-44 border-b border-r border-white/10 bg-[#171a19] px-3 py-2 text-xs font-semibold text-[#a9b8ae]">Scheduled for</th><th className="min-w-40 border-b border-r border-white/10 bg-[#171a19] px-3 py-2 text-xs font-semibold text-[#a9b8ae]">Profile & platforms</th><th className="min-w-28 border-b border-r border-white/10 bg-[#171a19] px-3 py-2 text-xs font-semibold text-[#a9b8ae]">Type & status</th><th className="min-w-52 border-b border-r border-white/10 bg-[#171a19] px-3 py-2 text-xs font-semibold text-[#a9b8ae]">Job ID</th><th className="w-28 border-b border-white/10 bg-[#171a19] px-3 py-2" /></tr></thead>
        <tbody>{scheduledPosts.map((post) => <tr className="border-b border-white/[0.075] bg-[#101212]" key={post.jobId}><td className="border-r border-white/[0.075] px-3 py-3"><MediaPreview onOpen={() => setPreviewPost(post)} post={post} /></td><td className="border-r border-white/[0.075] px-3 py-3 align-top"><p className="max-w-xl truncate text-sm font-medium text-[#f7f3ed]">{post.title ?? "Untitled post"}</p>{post.caption && post.caption !== post.title ? <p className="mt-1 max-w-xl whitespace-pre-wrap text-xs leading-5 text-[#a9b8ae]">{post.caption}</p> : null}</td><td className="border-r border-white/[0.075] px-3 py-3 align-top"><div className="flex items-start gap-2 text-sm text-[#d7e2da]"><CalendarClock className="mt-0.5 size-3.5 shrink-0 text-[#c7f05d]" aria-hidden="true" /><span>{formatScheduledDate(post.scheduledDate)}</span></div><p className="mt-1 text-[11px] text-[#718077]">Europe/Istanbul</p></td><td className="border-r border-white/[0.075] px-3 py-3 align-top"><p className="text-sm text-[#d7e2da]">{post.profileUsername ?? "No profile returned"}</p>{post.platforms.length ? <p className="mt-1 text-xs text-[#a9b8ae]">{post.platforms.join(", ")}</p> : <p className="mt-1 text-xs text-[#718077]">Platform not returned</p>}</td><td className="border-r border-white/[0.075] px-3 py-3 align-top"><p className="text-sm capitalize text-[#d7e2da]">{post.postType ?? "Unknown"}</p><p className="mt-1 text-xs capitalize text-[#c7f05d]">{post.status ?? "scheduled"}</p></td><td className="border-r border-white/[0.075] px-3 py-3 align-top"><code className="block max-w-52 truncate text-xs text-[#a9b8ae]" title={post.jobId}>{post.jobId}</code></td><td className="px-3 py-3 align-top"><Button className="h-8 border-transparent bg-transparent px-2 text-xs text-[#ff9c8b] hover:bg-[#2c1917]" disabled={cancellingJobId !== null} onClick={() => void cancelPost(post)} type="button">{cancellingJobId === post.jobId ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}Cancel</Button></td></tr>)}</tbody>
      </table>
      {state === "loading" ? <div className="grid min-h-52 place-items-center text-sm text-[#8d9b92]"><LoaderCircle className="mr-2 inline size-4 animate-spin" />Loading scheduled posts...</div> : !scheduledPosts.length ? <div className="grid min-h-52 place-items-center text-sm text-[#8d9b92]">No scheduled posts were returned by Upload-Post.</div> : null}
    </div>

    <footer className="flex min-h-11 shrink-0 items-center justify-between gap-4 border-t border-white/10 bg-[#171a19] px-3 text-xs sm:px-5"><span className="flex min-w-0 items-center gap-2 text-[#829287]">{state === "error" ? <CircleAlert className="size-3.5 shrink-0 text-[#ed7784]" /> : <CalendarClock className="size-3.5 shrink-0 text-[#c7f05d]" />}{message || "Media previews are temporary Upload-Post links. Select one to view it larger."}</span><span className="shrink-0 text-[#829287]">{scheduledPosts.length} shown</span></footer>

    {previewPost?.previewUrl ? <div aria-label="Media display mode" aria-modal="true" className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" role="dialog"><section className="relative flex max-h-full w-full max-w-5xl items-center justify-center"><Button aria-label="Close media display" className="absolute right-2 top-2 z-10 size-10 rounded border-white/15 bg-black/65 p-0 text-white hover:bg-black" onClick={() => setPreviewPost(null)} type="button"><X className="size-5" /></Button>{isVideo(previewPost) ? <video autoPlay className="max-h-[85dvh] max-w-full rounded-lg border border-white/15 bg-black" controls src={previewPost.previewUrl} /> : <img alt={previewPost.title ?? "Scheduled post media"} className="max-h-[85dvh] max-w-full rounded-lg border border-white/15 object-contain" src={previewPost.previewUrl} />}</section></div> : null}
  </section>;
}
