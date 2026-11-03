"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Flame, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useTheme } from "@/components/theme-provider";
import type { ThemeMode } from "@/lib/themes";
import { formatNumber } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import type { DailyStreakSnapshot } from "@/features/daily-streak/daily-streak-actions";
import type { LocaleCode } from "@/types/domain";
import { cn } from "@/lib/utils";
import {
  DAY_STREAK_OPENING_ATLAS_COUNT,
  DAY_STREAK_OPENING_ATLAS_COLUMNS,
  DAY_STREAK_OPENING_DURATION_SECONDS,
  DAY_STREAK_OPENING_FRAME_COUNT,
  DAY_STREAK_OPENING_FRAME_HEIGHT,
  DAY_STREAK_OPENING_FRAME_RATE,
  DAY_STREAK_OPENING_FRAMES_PER_ATLAS,
  DAY_STREAK_OPENING_FRAME_WIDTH,
  getDayStreakOpeningAtlasSource,
  loadDayStreakOpeningAtlasImage,
  preloadDayStreakFrames,
} from "@/features/daily-streak/day-streak-opening-frames";

const DAY_STREAK_CLOSE_DURATION = 360;
const DAY_STREAK_CALENDAR_TRANSITION_DURATION = 560;
const DAY_STREAK_VIDEO_FALLBACK_DURATION = 4500;
const DAY_STREAK_UI_EARLY_REVEAL = 1500;
const DAY_STREAK_AUDIO_SOURCE = "/day-streak/daily_streak_sfx.mp3?v=20261009-1";
const DAY_STREAK_DOUBLE_TAP_WINDOW = 320;
const DAY_STREAK_POSTER_SOURCES: Record<ThemeMode, string> = {
  dark: "/day-streak/day-streak-dark-v2-poster.webp",
};

export function MobileDayStreakMenu({
  open,
  onClose,
  onExited,
  snapshot,
  loading = false,
  highestStreak,
  streakPosition,
  onOpenLeaderboard,
}: {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  snapshot: DailyStreakSnapshot | null;
  loading?: boolean;
  highestStreak?: number | null;
  streakPosition?: number | null;
  onOpenLeaderboard?: () => void;
}) {
  const { mode } = useTheme();
  const { locale } = useLocale();
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const [contentReady, setContentReady] = useState(false);
  const [openingFramesUnavailable, setOpeningFramesUnavailable] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarClosing, setCalendarClosing] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(parseDateKey(snapshot?.today ?? getLocalDateKey(new Date()))));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const loadedAtlasesRef = useRef(new Map<number, HTMLImageElement>());
  const atlasPromisesRef = useRef(new Map<number, Promise<HTMLImageElement | null>>());
  const atlasGenerationRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const animationStartedRef = useRef(false);
  const animationFinishedRef = useRef(false);
  const animationStartTimeRef = useRef<number | null>(null);
  const audioStartedRef = useRef(false);
  const lastRequestedFrameRef = useRef(0);
  const lastDrawnFrameRef = useRef<number | null>(null);
  const drawFrameRef = useRef<(frameIndex: number) => void>(() => undefined);
  const lastTapAtRef = useRef<number | null>(null);
  const todayKey = snapshot?.today ?? getLocalDateKey(new Date());
  const loggedDates = useMemo(() => new Set(snapshot?.loggedDates ?? []), [snapshot?.loggedDates]);
  const weekDays = useMemo(() => getWeekDays(parseDateKey(todayKey)), [todayKey]);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  const ensureAtlasImage = useCallback((atlasIndex: number) => {
    if (atlasIndex < 0 || atlasIndex >= DAY_STREAK_OPENING_ATLAS_COUNT) {
      return Promise.resolve(null);
    }

    const loaded = loadedAtlasesRef.current.get(atlasIndex);
    if (loaded) return Promise.resolve(loaded);

    const pending = atlasPromisesRef.current.get(atlasIndex);
    if (pending) return pending;

    const generation = atlasGenerationRef.current;
    const request = loadDayStreakOpeningAtlasImage(getDayStreakOpeningAtlasSource(mode, atlasIndex))
      .then((image) => {
        if (generation !== atlasGenerationRef.current) {
          image.src = "data:,";
          return null;
        }

        loadedAtlasesRef.current.set(atlasIndex, image);
        drawFrameRef.current(lastRequestedFrameRef.current);
        return image;
      })
      .catch(() => null)
      .finally(() => {
        if (atlasPromisesRef.current.get(atlasIndex) === request) {
          atlasPromisesRef.current.delete(atlasIndex);
        }
      });

    atlasPromisesRef.current.set(atlasIndex, request);
    return request;
  }, [mode]);

  const drawFrame = useCallback((requestedFrame: number) => {
    const frameIndex = Math.max(0, Math.min(DAY_STREAK_OPENING_FRAME_COUNT - 1, requestedFrame));
    lastRequestedFrameRef.current = frameIndex;
    const atlasIndex = Math.floor(frameIndex / DAY_STREAK_OPENING_FRAMES_PER_ATLAS);
    const atlas = loadedAtlasesRef.current.get(atlasIndex);

    if (!atlas) {
      void ensureAtlasImage(atlasIndex);
      return;
    }

    if (
      atlasIndex + 1 < DAY_STREAK_OPENING_ATLAS_COUNT &&
      !loadedAtlasesRef.current.has(atlasIndex + 1) &&
      !atlasPromisesRef.current.has(atlasIndex + 1)
    ) {
      void ensureAtlasImage(atlasIndex + 1);
    }

    for (const loadedIndex of loadedAtlasesRef.current.keys()) {
      if (loadedIndex === atlasIndex || loadedIndex === atlasIndex + 1) continue;
      loadedAtlasesRef.current.delete(loadedIndex);
      atlasPromisesRef.current.delete(loadedIndex);
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false, desynchronized: true });
    if (!canvas || !context) return;

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const scale = Math.max(width / DAY_STREAK_OPENING_FRAME_WIDTH, height / DAY_STREAK_OPENING_FRAME_HEIGHT);
    const drawWidth = DAY_STREAK_OPENING_FRAME_WIDTH * scale;
    const drawHeight = DAY_STREAK_OPENING_FRAME_HEIGHT * scale;
    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;
    const frameInAtlas = frameIndex % DAY_STREAK_OPENING_FRAMES_PER_ATLAS;
    const sourceX = (frameInAtlas % DAY_STREAK_OPENING_ATLAS_COLUMNS) * DAY_STREAK_OPENING_FRAME_WIDTH;
    const sourceY = Math.floor(frameInAtlas / DAY_STREAK_OPENING_ATLAS_COLUMNS) * DAY_STREAK_OPENING_FRAME_HEIGHT;

    context.clearRect(0, 0, width, height);
    context.drawImage(
      atlas,
      sourceX,
      sourceY,
      DAY_STREAK_OPENING_FRAME_WIDTH,
      DAY_STREAK_OPENING_FRAME_HEIGHT,
      drawX,
      drawY,
      drawWidth,
      drawHeight,
    );
    lastDrawnFrameRef.current = frameIndex;
  }, [ensureAtlasImage]);

  const revealContent = useCallback(() => {
    if (!open) return;
    setPhase("open");
    setContentReady(true);
  }, [open]);

  const finishOpening = useCallback((showLastFrame = false) => {
    if (!open) return;
    animationFinishedRef.current = true;
    animationStartedRef.current = false;
    animationStartTimeRef.current = null;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (showLastFrame) drawFrameRef.current(DAY_STREAK_OPENING_FRAME_COUNT - 1);
    audioRef.current?.pause();
    revealContent();
  }, [open, revealContent]);

  const animateOpeningRef = useRef<(timestamp: number) => void>(() => undefined);
  const animateOpening = useCallback((timestamp: number) => {
    const startedAt = animationStartTimeRef.current;
    if (startedAt === null || !animationStartedRef.current || animationFinishedRef.current) return;

    const elapsed = Math.max(0, (timestamp - startedAt) / 1000);
    const animationTime = Math.min(elapsed, DAY_STREAK_OPENING_DURATION_SECONDS);
    const frameIndex = Math.min(
      DAY_STREAK_OPENING_FRAME_COUNT - 1,
      Math.floor(animationTime * DAY_STREAK_OPENING_FRAME_RATE),
    );
    drawFrameRef.current(frameIndex);

    if (DAY_STREAK_OPENING_DURATION_SECONDS - animationTime <= DAY_STREAK_UI_EARLY_REVEAL / 1000) {
      revealContent();
    }

    const audio = audioRef.current;
    if (audio) {
      const fadeStart = DAY_STREAK_OPENING_DURATION_SECONDS - 0.8;
      audio.volume = animationTime >= fadeStart
        ? Math.max(0, (DAY_STREAK_OPENING_DURATION_SECONDS - animationTime) / 0.8)
        : 1;
      if (audioStartedRef.current && !audio.paused && Math.abs(audio.currentTime - animationTime) > 0.16) {
        try {
          audio.currentTime = animationTime;
        } catch {
          // A rejected audio seek should not interrupt the frame timeline.
        }
      }
    }

    if (elapsed >= DAY_STREAK_OPENING_DURATION_SECONDS) {
      finishOpening(true);
      return;
    }

    animationFrameRef.current = window.requestAnimationFrame((nextTimestamp) => {
      animateOpeningRef.current(nextTimestamp);
    });
  }, [finishOpening, revealContent]);

  useEffect(() => {
    drawFrameRef.current = drawFrame;
  }, [drawFrame]);

  useEffect(() => {
    animateOpeningRef.current = animateOpening;
  }, [animateOpening]);

  const startOpening = useCallback(async () => {
    if (animationStartedRef.current || animationFinishedRef.current) return;
    const firstAtlas = await ensureAtlasImage(0);
    if (!firstAtlas || animationFinishedRef.current || !open) {
      if (!firstAtlas && !animationFinishedRef.current) {
        setOpeningFramesUnavailable(true);
        finishOpening();
      }
      return;
    }

    const canvas = canvasRef.current;
    let hasCanvasContext = false;
    try {
      hasCanvasContext = Boolean(canvas?.getContext("2d", { alpha: false, desynchronized: true }));
    } catch {
      hasCanvasContext = false;
    }
    if (!hasCanvasContext) {
      setOpeningFramesUnavailable(true);
      finishOpening();
      return;
    }

    animationStartedRef.current = true;
    animationStartTimeRef.current = window.performance.now();
    lastRequestedFrameRef.current = 0;
    drawFrameRef.current(0);
    void ensureAtlasImage(1);

    const audio = audioRef.current;
    if (audio) {
      audioStartedRef.current = false;
      audio.volume = 1;
      try {
        audio.currentTime = 0;
        const playback = audio.play?.();
        if (playback && typeof playback.then === "function") {
          void playback.then(() => {
            audioStartedRef.current = true;
          }).catch(() => {
            audioStartedRef.current = false;
          });
        } else {
          audioStartedRef.current = true;
        }
      } catch {
        audioStartedRef.current = false;
      }
    }

    animationFrameRef.current = window.requestAnimationFrame((timestamp) => {
      animateOpeningRef.current(timestamp);
    });
  }, [ensureAtlasImage, finishOpening, open]);

  useEffect(() => {
    if (!mounted || !open) return;

    const generation = ++atlasGenerationRef.current;
    animationFinishedRef.current = false;
    animationStartedRef.current = false;
    void startOpening();

    return () => {
      if (atlasGenerationRef.current === generation) atlasGenerationRef.current += 1;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      animationStartedRef.current = false;
      audioRef.current?.pause();
      loadedAtlasesRef.current.clear();
      atlasPromisesRef.current.clear();
    };
  }, [mounted, open, startOpening]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mounted || !open || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (lastDrawnFrameRef.current !== null) drawFrameRef.current(lastDrawnFrameRef.current);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [mounted, open]);

  useEffect(() => {
    if (open) {
      animationFinishedRef.current = false;
      animationStartedRef.current = false;
      animationStartTimeRef.current = null;
      lastTapAtRef.current = null;
      preloadDayStreakFrames(mode);

      const mountTimer = window.setTimeout(() => {
        setMounted(true);
        setPhase("opening");
        setContentReady(false);
        setOpeningFramesUnavailable(false);
        setCalendarOpen(false);
        setCalendarClosing(false);
        setCalendarMonth(startOfMonth(parseDateKey(todayKey)));
      });

      const fallbackTimer = window.setTimeout(() => {
        if (!animationStartedRef.current) {
          animationFinishedRef.current = true;
          audioRef.current?.pause();
        }
        setPhase("open");
        setContentReady(true);
      }, DAY_STREAK_VIDEO_FALLBACK_DURATION);

      return () => {
        window.clearTimeout(mountTimer);
        window.clearTimeout(fallbackTimer);
      };
    }

    if (!mounted) return;

    animationFinishedRef.current = true;
    animationStartedRef.current = false;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    audioRef.current?.pause();
    const closeFrame = window.requestAnimationFrame(() => setPhase("closing"));
    const closeTimer = window.setTimeout(() => {
      setMounted(false);
      onExited?.();
    }, DAY_STREAK_CLOSE_DURATION);

    return () => {
      window.cancelAnimationFrame(closeFrame);
      window.clearTimeout(closeTimer);
    };
  }, [mode, onExited, open]);

  useEffect(() => {
    if (!calendarClosing) {
      return;
    }

    const closeTimer = window.setTimeout(() => {
      setCalendarOpen(false);
      setCalendarClosing(false);
    }, DAY_STREAK_CALENDAR_TRANSITION_DURATION);

    return () => window.clearTimeout(closeTimer);
  }, [calendarClosing]);

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

  const streak = Math.max(1, snapshot?.currentStreak ?? 1);
  const highestStreakValue = Math.max(1, highestStreak ?? streak);
  const superWater = canUseSuperWater(locale);
  const skipOpeningAnimation = () => {
    if (!open || animationFinishedRef.current) return;
    finishOpening(true);
  };
  const handleOpeningPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }

    const now = performance.now();
    const previousTapAt = lastTapAtRef.current;
    lastTapAtRef.current = now;

    if (previousTapAt !== null && now - previousTapAt <= DAY_STREAK_DOUBLE_TAP_WINDOW) {
      lastTapAtRef.current = null;
      skipOpeningAnimation();
    }
  };

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[70] overflow-hidden bg-[var(--background)] transition-[opacity,transform] duration-[360ms] ease-[cubic-bezier(0.85,0,0.15,1)] lg:hidden",
        phase === "closing" ? "pointer-events-none scale-[0.98] opacity-0" : "scale-100 opacity-100",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={calendarOpen ? t("dayStreak.calendarTitle") : t("dayStreak.title")}
      data-mobile-day-streak-menu
      data-mobile-day-streak-phase={phase}
      data-day-streak-content-ready={contentReady}
      onPointerUp={handleOpeningPointerUp}
      onDoubleClick={skipOpeningAnimation}
    >
      <Image
        src={DAY_STREAK_POSTER_SOURCES[mode]}
        alt=""
        aria-hidden="true"
        fill
        priority
        unoptimized
        data-day-streak-background-poster
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
      {!openingFramesUnavailable ? <canvas
        ref={canvasRef}
        aria-hidden="true"
        data-day-streak-background-frames
        className="day-streak-opening-background absolute inset-0 z-0 h-full w-full"
      /> : null}
      <audio
        ref={audioRef}
        src={DAY_STREAK_AUDIO_SOURCE}
        preload="auto"
        aria-hidden="true"
        data-day-streak-audio
      />
      <button
        type="button"
        onClick={() => {
          if (calendarOpen) {
            if (!calendarClosing) {
              setCalendarClosing(true);
            }
            return;
          }

          onClose();
        }}
        aria-label={t("common.close")}
        data-mobile-back-close
        className={cn(
          "absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-40 inline-flex size-12 items-center justify-center text-white transition-transform duration-200 active:scale-90",
          contentReady ? "day-streak-ui-enter" : "day-streak-ui-pending",
        )}
        style={getDayStreakEnterStyle(0)}
        data-day-streak-ui="close"
      >
        <X className="size-9 stroke-[3]" aria-hidden="true" />
      </button>

      {!calendarOpen && onOpenLeaderboard ? (
        <button
          type="button"
          onClick={onOpenLeaderboard}
          aria-label={t("leaderboard.streaks")}
          className={cn(
            "absolute left-5 top-[max(1rem,env(safe-area-inset-top))] z-40 flex flex-col items-start text-left text-white transition-transform duration-200 active:scale-95",
            contentReady ? "day-streak-ui-enter" : "day-streak-ui-pending",
          )}
          style={getDayStreakEnterStyle(0)}
          data-day-streak-world-ranking
        >
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className={cn(
              "text-[clamp(0.9rem,4vw,1.25rem)] font-semibold uppercase leading-none text-white/90",
              superWater && "font-super-water",
            )}>
              {formatSuperWaterUppercaseText(locale, t("dayStreak.longestSeries"))}
            </span>
            <span className={cn(
              "inline-flex items-center gap-1 text-[clamp(1.8rem,8vw,2.7rem)] font-bold leading-none drop-shadow-[0_3px_8px_rgba(0,0,0,0.22)]",
              superWater && "font-super-water",
            )}>
              <span>{formatSuperWaterText(locale, formatNumber(locale, highestStreakValue))}</span>
              <Flame className="relative -top-1 size-7 fill-white text-white" aria-hidden="true" />
            </span>
          </span>
          <span className={cn("mt-1 text-[clamp(1.15rem,5vw,1.8rem)] font-semibold uppercase leading-none text-white/90", superWater && "font-super-water")}>
            {streakPosition === null || streakPosition === undefined
              ? formatSuperWaterUppercaseText(locale, t("leaderboard.worldPositionUnavailable"))
              : formatSuperWaterUppercaseText(
                  locale,
                  t("leaderboard.worldPosition", {
                    position: formatNumber(locale, streakPosition),
                  }),
                )}
          </span>
        </button>
      ) : null}

      {calendarOpen ? (
        <CalendarView
          calendarDays={calendarDays}
          calendarMonth={calendarMonth}
          loggedDates={loggedDates}
          locale={locale}
          todayKey={todayKey}
          onPreviousMonth={() => setCalendarMonth((current) => shiftMonth(current, -1))}
          onNextMonth={() => setCalendarMonth((current) => shiftMonth(current, 1))}
          useSuperWater={superWater}
          t={t}
          closing={calendarClosing}
        />
      ) : null}

      <main
        className={cn(
          "relative z-30 flex min-h-full flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(5rem,env(safe-area-inset-top)+3.5rem)] text-white",
          calendarOpen && "pointer-events-none",
        )}
      >
        <div className="flex flex-1 items-end justify-center pb-5">
          {!calendarOpen ? (
            <section className="flex w-full max-w-[32rem] flex-col items-center text-center" data-day-streak-week-view>
              {loading ? (
                <div
                  className={cn(
                    "relative -top-6 flex h-[clamp(5.5rem,24vw,9rem)] items-center justify-center text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)]",
                    contentReady ? "day-streak-ui-enter" : "day-streak-ui-pending",
                  )}
                  style={getDayStreakEnterStyle(80)}
                  data-day-streak-current-streak-loading
                  aria-label={t("common.loading")}
                >
                  <Loader2 className="size-[clamp(3rem,14vw,5rem)] animate-spin" aria-hidden="true" />
                </div>
              ) : (
                <p
                  className={cn(
                    "relative -top-6 text-[clamp(5.5rem,24vw,9rem)] font-bold leading-[0.78] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)]",
                    superWater && "font-super-water",
                    contentReady ? "day-streak-ui-enter" : "day-streak-ui-pending",
                  )}
                  style={getDayStreakEnterStyle(80)}
                  data-day-streak-current-streak
                >
                  {formatSuperWaterText(locale, formatNumber(locale, streak))}
                </p>
              )}
              <h1
                className={cn(
                  "relative -top-6 mt-5 text-[clamp(1.7rem,7vw,2.8rem)] font-bold leading-none text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.25)]",
                  superWater && "font-super-water",
                  contentReady ? "day-streak-ui-enter" : "day-streak-ui-pending",
                )}
                style={getDayStreakEnterStyle(160)}
              >
                {formatSuperWaterUppercaseText(locale, t("dayStreak.dailySeries"))}
              </h1>
              <div
                className={cn(
                  "mt-9 grid w-full grid-cols-7 gap-1.5 sm:gap-3",
                  contentReady ? "day-streak-ui-enter" : "day-streak-ui-pending",
                )}
                style={getDayStreakEnterStyle(240)}
                data-day-streak-week
              >
                {weekDays.map((day) => {
                  const isLogged = loggedDates.has(day.key);

                  return (
                    <div
                      key={day.key}
                      className="relative -top-6 isolate flex min-w-0 flex-col items-center gap-2"
                      data-day-streak-day={day.key}
                    >
                      <span
                        className={cn(
                          "relative z-20 inline-flex shrink-0 whitespace-nowrap text-xs font-semibold uppercase leading-none text-white/90",
                          superWater && "font-super-water",
                        )}
                        data-day-streak-weekday={day.key}
                      >
                        {formatSuperWaterUppercaseText(locale, shortWeekday(day.date, locale))}
                      </span>
                      <span
                        className={cn(
                          "relative inline-flex size-10 items-center justify-center rounded-full border-4 border-white bg-[#303030] text-white transition-colors sm:size-12",
                          isLogged && "border-white bg-white",
                        )}
                        aria-label={isLogged ? t("dayStreak.loggedIn") : t("dayStreak.notLoggedIn")}
                      >
                        {isLogged ? (
                          <Flame
                            className="day-streak-check-enter size-6 text-red-500 sm:size-7"
                            fill="currentColor"
                            aria-hidden="true"
                          />
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>

        <div
          className={cn(
            "relative -top-[25px] z-40 mx-auto grid w-full max-w-[32rem] grid-cols-2 gap-3 pointer-events-auto",
            contentReady ? "day-streak-ui-enter" : "day-streak-ui-pending",
          )}
          style={getDayStreakEnterStyle(480)}
          data-day-streak-actions
        >
          <button
            type="button"
            onClick={() => {
              if (calendarOpen) {
                if (!calendarClosing) {
                  setCalendarClosing(true);
                }
                return;
              }

              setCalendarOpen(true);
            }}
            className={cn(
              "inline-flex h-14 items-center justify-center gap-2 rounded-full bg-red-500 px-3 text-center text-base font-semibold text-white transition-transform active:scale-[0.98]",
              superWater && "font-super-water",
            )}
            data-day-streak-calendar
          >
            {formatSuperWaterUppercaseText(locale, t(calendarOpen ? "dayStreak.weekView" : "dayStreak.calendar"))}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "inline-flex h-14 items-center justify-center rounded-full bg-white px-3 text-center text-base font-semibold text-[#F08608] transition-transform active:scale-[0.98]",
              superWater && "font-super-water",
            )}
            data-day-streak-close
          >
            {formatSuperWaterUppercaseText(locale, t("dayStreak.comeBack"))}
          </button>
        </div>
      </main>
    </div>,
    document.body,
  );
}

type DayStreakEnterStyle = CSSProperties & {
  "--day-streak-enter-delay": string;
};

function getDayStreakEnterStyle(delayMs: number): DayStreakEnterStyle {
  return { "--day-streak-enter-delay": `${delayMs}ms` };
}

function CalendarView({
  calendarDays,
  calendarMonth,
  loggedDates,
  locale,
  todayKey,
  onPreviousMonth,
  onNextMonth,
  useSuperWater,
  t,
  closing,
}: {
  calendarDays: CalendarDay[];
  calendarMonth: Date;
  loggedDates: Set<string>;
  locale: LocaleCode;
  todayKey: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  useSuperWater: boolean;
  t: ReturnType<typeof useT>;
  closing: boolean;
}) {
  const weekHeaders = getWeekDays(calendarMonth).map((day) =>
    formatSuperWaterUppercaseText(locale, shortWeekday(day.date, locale)),
  );

  return (
    <section
      className={cn(
        "absolute inset-0 z-20 flex items-center justify-center overflow-hidden bg-black px-5 pb-[max(7.5rem,env(safe-area-inset-bottom)+6rem)] pt-[max(5rem,env(safe-area-inset-top)+3.5rem)] text-white",
        closing ? "day-streak-calendar-exit" : "day-streak-calendar-enter",
      )}
      data-day-streak-calendar-view
    >
      <div className="flex w-full max-w-[32rem] flex-col items-center justify-center gap-8">
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPreviousMonth}
            aria-label={t("dayStreak.previousMonth")}
            className="inline-flex size-11 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-white transition-transform active:scale-95"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <h1 className={cn("text-center text-xl font-bold capitalize text-white", useSuperWater && "font-super-water")}>
            {formatSuperWaterText(locale, formatMonth(calendarMonth, locale))}
          </h1>
          <button
            type="button"
            onClick={onNextMonth}
            aria-label={t("dayStreak.nextMonth")}
            className="inline-flex size-11 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-white transition-transform active:scale-95"
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </div>
        <div className="grid w-full grid-cols-7 gap-y-4 text-center">
          {weekHeaders.map((day, index) => (
            <span key={`${day}-${index}`} className={cn("text-xs font-semibold uppercase text-white/80", useSuperWater && "font-super-water")}>
              {day}
            </span>
          ))}
          {calendarDays.map((day) => {
            const isLogged = loggedDates.has(day.key);
            const isToday = day.key === todayKey;

            return (
              <div key={day.key} className="flex min-h-10 items-center justify-center">
                <span
                  className={cn(
                    "inline-flex h-9 min-w-10 items-center justify-center rounded-lg bg-[#292929] px-2 text-sm font-semibold text-white/65",
                    day.inMonth && "text-white",
                    isLogged && "text-red-500",
                    isToday && "bg-white text-black ring-2 ring-white",
                  )}
                >
                  {isLogged ? <Flame className="size-5" fill="currentColor" aria-hidden="true" /> : day.day}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

type CalendarDay = { key: string; day: number; inMonth: boolean; date: Date };

function getWeekDays(date: Date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return { date: day, key: getLocalDateKey(day) };
  });
}

function getCalendarDays(month: Date): CalendarDay[] {
  const firstDay = startOfMonth(month);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const previousMonthDays = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayOffset = index - offset + 1;
    const date = new Date(month.getFullYear(), month.getMonth(), dayOffset, 12);
    const inMonth = dayOffset >= 1 && dayOffset <= daysInMonth;
    const day = inMonth
      ? dayOffset
      : dayOffset < 1
        ? previousMonthDays + dayOffset
        : dayOffset - daysInMonth;

    return { key: getLocalDateKey(date), day, inMonth, date };
  });
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (![year, month, day].every(Number.isFinite)) return new Date();
  return new Date(year, month - 1, day, 12);
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

function shortWeekday(date: Date, locale: LocaleCode) {
  const value = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date).replaceAll(".", "").trim();
  return Array.from(value).slice(0, 3).join("");
}

function formatMonth(date: Date, locale: LocaleCode) {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}
