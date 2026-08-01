"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type SocialPublishImageAsset = {
  dataUrl: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
};

export type SocialPublishVideoAsset = {
  sourceUrl: string;
  mimeType: "video/mp4" | "video/webm";
};

export type SocialPublishAsset = SocialPublishImageAsset | SocialPublishVideoAsset;

type PublishTarget = {
  id: number;
  platform: string;
  accountName: string;
  status: string;
};

type PublishState = "idle" | "preparing" | "sending" | "sent" | "error";

function platformKey(platform: string) {
  return platform.trim().toLocaleLowerCase();
}

function isVideoAsset(asset: SocialPublishAsset | undefined): asset is SocialPublishVideoAsset {
  return Boolean(asset && "sourceUrl" in asset);
}

function PlatformIcon({ platform }: { platform: string }) {
  const key = platformKey(platform);
  const common = { className: "size-4", fill: "currentColor", viewBox: "0 0 24 24", "aria-hidden": true } as const;
  if (key === "x") return <svg {...common}><path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.24-8.27L2.95 2h6.4l4.42 5.84L18.9 2Zm-1.1 18h1.73L8.4 3.9H6.55L17.8 20Z" /></svg>;
  if (key === "instagram") return <svg {...common}><path fillRule="evenodd" d="M7 2C4.24 2 2 4.24 2 7v10c0 2.76 2.24 5 5 5h10c2.76 0 5-2.24 5-5V7c0-2.76-2.24-5-5-5H7Zm0 2h10c1.65 0 3 1.35 3 3v10c0 1.65-1.35 3-3 3H7c-1.65 0-3-1.35-3-3V7c0-1.65 1.35-3 3-3Zm5 3.5A4.5 4.5 0 1 0 12 16a4.5 4.5 0 0 0 0-9Zm0 2A2.5 2.5 0 1 1 12 14a2.5 2.5 0 0 1 0-5Zm5.25-2.75a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z" clipRule="evenodd" /></svg>;
  if (key === "facebook") return <svg {...common}><path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.25-1.5 1.55-1.5H16.7V4.9c-.3-.04-1.35-.12-2.55-.12-2.52 0-4.25 1.54-4.25 4.38V11H7v3h2.9v8h3.6Z" /></svg>;
  if (key === "threads") return <svg {...common}><path d="M12.2 2C6.57 2 3.5 5.3 3.5 11.7c0 6.15 3.37 10.3 8.47 10.3 4.85 0 7.68-3.24 7.68-7.1 0-3.16-1.88-5.25-4.95-5.25-2.47 0-4.25 1.44-4.25 3.65 0 1.85 1.36 3.07 3.35 3.07 1.1 0 2.03-.37 2.65-.9-.37 1.55-1.62 2.57-3.95 2.57-3.4 0-5.57-2.45-5.57-6.3 0-4.25 2.05-6.72 5.25-6.72 2.85 0 4.54 1.5 4.95 4.13l2.75-.56C19.25 4.42 16.83 2 12.2 2Zm1.8 10.05c1.2 0 2.05.78 2.05 1.85 0 .58-.14 1.05-.35 1.42-.44.35-1.02.54-1.65.54-.73 0-1.25-.52-1.25-1.3 0-.95.55-1.5 1.2-1.5Z" /></svg>;
  if (key === "youtube") return <svg {...common}><path d="M23.5 6.2a3 3 0 0 0-2.1-2.12C19.55 3.58 12 3.58 12 3.58s-7.55 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.07 0 12 0 12s0 3.93.5 5.8a3 3 0 0 0 2.1 2.12c1.85.5 9.4.5 9.4.5s7.55 0 9.4-.5a3 3 0 0 0 2.1-2.12C24 15.93 24 12 24 12s0-3.93-.5-5.8ZM9.6 15.6V8.4l6.27 3.6-6.27 3.6Z" /></svg>;
  if (key === "tiktok") return <svg {...common}><path d="M19.6 5.2a5.7 5.7 0 0 1-3.55-1.24A5.73 5.73 0 0 1 14.05.5h-3.5v14.25a2.8 2.8 0 1 1-1.93-2.66v-3.57a6.35 6.35 0 1 0 5.43 6.28V7.57A9.2 9.2 0 0 0 19.6 9.4V5.2Z" /></svg>;
  if (key === "pinterest") return <svg {...common}><path d="M12 0a12 12 0 0 0-4.38 23.18c-.06-1.97-.01-4.34.5-6.5l1.2-5.1s-.3-.6-.3-1.5c0-1.4.82-2.45 1.84-2.45.87 0 1.29.65 1.29 1.43 0 .87-.55 2.17-.84 3.38-.24 1.01.51 1.84 1.5 1.84 1.8 0 3.18-1.9 3.18-4.65 0-2.43-1.75-4.13-4.25-4.13-2.89 0-4.58 2.16-4.58 4.4 0 .87.33 1.8.75 2.3.08.1.1.19.07.3l-.28 1.13c-.05.18-.16.22-.36.13-1.35-.63-2.2-2.6-2.2-4.18 0-3.4 2.47-6.52 7.13-6.52 3.75 0 6.66 2.67 6.66 6.23 0 3.72-2.34 6.72-5.6 6.72-1.1 0-2.13-.57-2.48-1.25l-.67 2.54c-.24.93-.9 2.09-1.35 2.8A12 12 0 1 0 12 0Z" /></svg>;
  return <svg {...common}><path d="M12 2a10 10 0 1 0 .01 20.01A10 10 0 0 0 12 2Zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm-1 3v5.4l4.25 2.55 1-1.7-3.25-1.95V7H11Z" /></svg>;
}

export function SocialPublishActions({ caption, getAsset, disabled = false }: {
  caption: string;
  getAsset?: () => Promise<SocialPublishAsset | undefined>;
  disabled?: boolean;
}) {
  const [targets, setTargets] = useState<PublishTarget[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [draftCaption, setDraftCaption] = useState(caption);
  const [asset, setAsset] = useState<SocialPublishAsset>();
  const [state, setState] = useState<PublishState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch("/api/twitter-automation/publish-targets", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ accounts?: PublishTarget[] }> : { accounts: [] })
      .then((payload) => setTargets(Array.isArray(payload.accounts) ? payload.accounts : []))
      .catch(() => setTargets([]));
  }, []);

  const platforms = [...new Map(targets.map((target) => [platformKey(target.platform), target.platform])).entries()];
  const selectedTargets = targets.filter((target) => platformKey(target.platform) === selectedPlatform);
  const selectedTarget = selectedTargets.find((target) => target.id === selectedTargetId) ?? selectedTargets[0];
  const selectedPlatformKey = selectedTarget ? platformKey(selectedTarget.platform) : null;
  const uploadPostReady = selectedTarget?.status === "ready";
  const textOnly = !getAsset;
  const textOnlySupported = selectedPlatformKey ? ["x", "linkedin", "facebook", "threads", "reddit", "bluesky", "discord", "telegram", "google_business", "slack", "mastodon", "nostr", "lemmy", "devto", "hashnode", "wordpress", "whop", "listmonk"].includes(selectedPlatformKey) : false;

  async function openPublisher(platform: string) {
    if (disabled || !caption) return;
    setSelectedPlatform(platformKey(platform));
    const firstTarget = targets.find((target) => platformKey(target.platform) === platformKey(platform));
    setSelectedTargetId(firstTarget?.id ?? null);
    setDraftCaption(caption);
    setAsset(undefined);
    setState(getAsset ? "preparing" : "idle");
    setMessage("");
    if (!getAsset) return;

    try {
      setAsset(await getAsset());
      setState("idle");
    } catch {
      setState("error");
      setMessage("The generated media could not be prepared for publishing.");
    }
  }

  async function publish() {
    if (!selectedTarget || !draftCaption || state === "sending") return;
    setState("sending");
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ socialMediaId: selectedTarget.id, caption: draftCaption, ...(asset ? { asset } : {}) }),
      });
      const payload = await response.json().catch(() => null) as { errorCode?: string; postUrl?: string | null; requestId?: string | null; jobId?: string | null } | null;
      if (!response.ok) {
        const errors: Record<string, string> = {
          account_not_found: "This social media account no longer exists. Refresh the publishing targets and try again.",
          invalid_media: "This media cannot be uploaded. Use a PNG, JPEG, or WebP image under 5 MB, or a secure video URL.",
          upload_post_not_configured: "Upload-Post API key is not configured on this deployment.",
          upload_post_profile_not_configured: "Set this account's Upload-Post profile username in Social medias before publishing.",
          upload_post_pinterest_board_not_configured: "Set UPLOAD_POST_PINTEREST_BOARD_ID before publishing to Pinterest.",
          upload_post_unsupported_content: "Upload-Post does not support this content format for the selected platform.",
          upload_post_rejected: "Upload-Post rejected this upload. Check its dashboard for account permissions, limits, and platform requirements.",
        };
        throw new Error(errors[payload?.errorCode ?? ""] ?? "Upload-Post could not publish this post. Try again.");
      }
      setState("sent");
      setMessage(payload?.postUrl ? `Published successfully: ${payload.postUrl}` : payload?.requestId ? `Upload accepted by Upload-Post. Request: ${payload.requestId}` : payload?.jobId ? `Scheduled in Upload-Post. Job: ${payload.jobId}` : "Upload accepted by Upload-Post.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "The post could not be published.");
    }
  }

  return <>
    <div className="flex items-center gap-1">
      {platforms.map(([key, label]) => <Button aria-label={`Publish to ${label}`} className="size-8 rounded border-white/15 bg-white/[0.07] p-0 text-white hover:bg-white/[0.14]" disabled={disabled || !caption} key={key} onClick={() => void openPublisher(label)} title={label} type="button"><PlatformIcon platform={label} /></Button>)}
    </div>
    {selectedPlatform ? <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label="Publish social content">
      <section className="w-full max-w-md rounded-xl border border-white/15 bg-[#1b1714] p-5 text-[#f9f2e9] shadow-sm">
        <header className="flex items-center justify-between gap-4"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-lg bg-white/10"><PlatformIcon platform={selectedPlatform} /></span><div><h2 className="text-base font-semibold">Publish to {selectedPlatform}</h2><p className="text-xs text-[#cdbfb3]">Sent through Upload-Post. Review before sending.</p></div></div><Button aria-label="Close publisher" className="size-8 rounded border-transparent bg-transparent p-0 text-[#cdbfb3] hover:bg-white/10 hover:text-white" onClick={() => setSelectedPlatform(null)} type="button"><X className="size-4" /></Button></header>
        <label className="mt-5 block text-xs font-semibold text-[#d7c9bc]">Social account</label>
        <select className="mt-2 h-10 w-full rounded-lg border border-white/15 bg-[#100d0c] px-3 text-sm text-white outline-none focus:border-[#f5ac27]" onChange={(event) => setSelectedTargetId(Number(event.target.value))} value={selectedTarget?.id ?? ""}>{selectedTargets.map((target) => <option key={target.id} value={target.id}>{target.accountName}{target.status === "ready" ? " - Upload-Post ready" : " - Upload-Post setup required"}</option>)}</select>
        <label className="mt-4 block text-xs font-semibold text-[#d7c9bc]">Post text</label>
        <textarea className="mt-2 min-h-36 w-full resize-y rounded-lg border border-white/15 bg-[#100d0c] p-3 text-sm leading-6 text-white outline-none focus:border-[#f5ac27]" maxLength={280} onChange={(event) => setDraftCaption(event.target.value)} value={draftCaption} />
        <p className="mt-1 text-right text-xs text-[#8d8177]">{draftCaption.length}/280</p>
        {getAsset ? <p className="mt-3 text-xs text-[#cdbfb3]">{state === "preparing" ? "Preparing generated media..." : asset ? isVideoAsset(asset) ? "Generated video will be uploaded." : "Generated image will be attached." : "No media will be attached."}</p> : null}
        {selectedTarget?.status === "not_configured" ? <p className="mt-3 text-xs leading-5 text-[#ffcf82]">Set the server-only Upload-Post API key before publishing.</p> : null}
        {selectedTarget?.status === "profile_required" ? <p className="mt-3 text-xs leading-5 text-[#ffcf82]">Set this account&apos;s Upload-Post profile username in Social medias before publishing.</p> : null}
        {textOnly && !textOnlySupported ? <p className="mt-3 text-xs leading-5 text-[#ffcf82]">Upload-Post needs an image or video for {selectedPlatform}. Choose a generated visual instead.</p> : null}
        {message ? <p className={state === "sent" ? "mt-4 text-sm text-[#9be0b9]" : "mt-4 text-sm text-[#ffb9c1]"}>{message}</p> : null}
        <div className="mt-5 flex justify-end gap-2"><Button className="border-white/15 bg-white/10 text-white hover:bg-white/15" onClick={() => setSelectedPlatform(null)} type="button">Cancel</Button><Button className="bg-[#f5ac27] text-[#251106] hover:bg-[#ffbf40]" disabled={!selectedTarget || !draftCaption || !uploadPostReady || !textOnlySupported && textOnly || state === "preparing" || state === "sending"} onClick={() => void publish()} type="button">{state === "sending" ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}Send</Button></div>
      </section>
    </div> : null}
  </>;
}
