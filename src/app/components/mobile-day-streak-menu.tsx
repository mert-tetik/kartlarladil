"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import type { ThemeMode } from "@/lib/themes";
import { cn } from "@/lib/utils";

const DAY_STREAK_CLOSE_DURATION = 360;
const DAY_STREAK_GREEN_VIDEO_SOURCE = "/day-streak/day-streak-green-2x-v2.mp4";
const DAY_STREAK_GREEN_POSTER_SOURCE = "/day-streak/day-streak-green-poster.webp";
const DAY_STREAK_VIDEO_SOURCES: Record<ThemeMode, string> = {
  dark: DAY_STREAK_GREEN_VIDEO_SOURCE,
  light: DAY_STREAK_GREEN_VIDEO_SOURCE,
};
const DAY_STREAK_POSTER_SOURCES: Record<ThemeMode, string> = {
  dark: DAY_STREAK_GREEN_POSTER_SOURCE,
  light: DAY_STREAK_GREEN_POSTER_SOURCE,
};

const preloadedDayStreakVideos = new Map<string, HTMLVideoElement>();

export function preloadDayStreakVideo(mode: ThemeMode) {
  if (typeof window === "undefined") {
    return;
  }

  const source = DAY_STREAK_VIDEO_SOURCES[mode];
  if (preloadedDayStreakVideos.has(source)) {
    return;
  }

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = source;
  video.load();
  preloadedDayStreakVideos.set(source, video);
}

export function MobileDayStreakMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { mode } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoSource = DAY_STREAK_VIDEO_SOURCES[mode];

  useEffect(() => {
    if (open) {
      setMounted(true);
      setPhase("opening");
      preloadDayStreakVideo(mode);
      return;
    }

    if (!mounted) return;

    setPhase("closing");
    const closeTimer = window.setTimeout(() => {
      setMounted(false);
    }, DAY_STREAK_CLOSE_DURATION);

    return () => window.clearTimeout(closeTimer);
  }, [mode, open]);

  useEffect(() => {
    if (!mounted || !open) {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const startVideo = () => {
      video.currentTime = 0;
      void video.play().catch(() => undefined);
    };

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      startVideo();
      return;
    }

    video.addEventListener("canplay", startVideo, { once: true });
    video.load();
    return () => video.removeEventListener("canplay", startVideo);
  }, [mounted, open, videoSource]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[70] overflow-hidden bg-[var(--background)] transition-[opacity,transform] duration-[360ms] ease-[cubic-bezier(0.85,0,0.15,1)] lg:hidden",
        phase === "closing" ? "pointer-events-none scale-[0.98] opacity-0" : "scale-100 opacity-100",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Daily streak"
      data-mobile-day-streak-menu
      data-mobile-day-streak-phase={phase}
    >
      <video
        ref={videoRef}
        key={videoSource}
        src={videoSource}
        poster={DAY_STREAK_POSTER_SOURCES[mode]}
        autoPlay
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close daily streak"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 inline-flex size-12 items-center justify-center text-white transition-transform duration-200 active:scale-90"
      >
        <X className="size-9 stroke-[3]" aria-hidden="true" />
      </button>
    </div>,
    document.body,
  );
}
