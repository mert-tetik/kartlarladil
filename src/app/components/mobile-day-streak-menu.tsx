"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { ChevronLeft, ChevronRight, Flame, Loader2, X } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import type { ThemeMode } from "@/lib/themes";
import { formatNumber } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";
import type { DailyStreakSnapshot } from "@/features/daily-streak/daily-streak-actions";
import type { LocaleCode } from "@/types/domain";
import { cn } from "@/lib/utils";

const DAY_STREAK_CLOSE_DURATION = 360;
const DAY_STREAK_CALENDAR_TRANSITION_DURATION = 560;
const DAY_STREAK_VIDEO_FALLBACK_DURATION = 4500;
const DAY_STREAK_UI_EARLY_REVEAL = 1500;
const DAY_STREAK_IDLE_BACKGROUND_LEAD_TIME = 350;
const DAY_STREAK_IDLE_BACKGROUND_SOURCE = "/day-streak/day-streak-idle-hq-v1.mp4";
const DAY_STREAK_VIDEO_SOURCES: Record<ThemeMode, string> = {
  dark: "/day-streak/day-streak-dark-v3.mp4",
  light: "/day-streak/day-streak-light-v3.mp4",
};
const DAY_STREAK_POSTER_SOURCES: Record<ThemeMode, string> = {
  dark: "/day-streak/day-streak-dark-v2-poster.webp",
  light: "/day-streak/day-streak-light-v2-poster.webp",
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
  const [idleBackgroundReady, setIdleBackgroundReady] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarClosing, setCalendarClosing] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(parseDateKey(snapshot?.today ?? getLocalDateKey(new Date()))));
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const videoSource = DAY_STREAK_VIDEO_SOURCES[mode];
  const todayKey = snapshot?.today ?? getLocalDateKey(new Date());
  const loggedDates = useMemo(() => new Set(snapshot?.loggedDates ?? []), [snapshot?.loggedDates]);
  const weekDays = useMemo(() => getWeekDays(parseDateKey(todayKey)), [todayKey]);
  const calendarDays = useMemo(() => getCalendarDays(calendarMonth), [calendarMonth]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setPhase("opening");
      setContentReady(false);
      setIdleBackgroundReady(false);
      setCalendarOpen(false);
      setCalendarClosing(false);
      setCalendarMonth(startOfMonth(parseDateKey(todayKey)));
      preloadDayStreakVideo(mode);

      const fallbackTimer = window.setTimeout(() => {
        setPhase("open");
        setContentReady(true);
        setIdleBackgroundReady(true);
      }, DAY_STREAK_VIDEO_FALLBACK_DURATION);

      return () => window.clearTimeout(fallbackTimer);
    }

    if (!mounted) return;

    setPhase("closing");
    const closeTimer = window.setTimeout(() => {
      setMounted(false);
      onExited?.();
    }, DAY_STREAK_CLOSE_DURATION);

    return () => window.clearTimeout(closeTimer);
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

  const finishOpeningVideo = () => {
    if (!open) {
      return;
    }

    revealContent();
    setIdleBackgroundReady(true);
  };

  useEffect(() => {
    if (!mounted || !open || !idleBackgroundReady) {
      return;
    }

    const video = idleVideoRef.current;
    if (!video) {
      return;
    }

    video.currentTime = 0;
    void Promise.resolve(video.play()).catch(() => undefined);

    return () => {
      video.pause();
    };
  }, [idleBackgroundReady, mounted, open]);

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
  const revealContent = () => {
    if (!open) {
      return;
    }

    setPhase("open");
    setContentReady(true);
  };
  const handleVideoTimeUpdate = (event: SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (
      !idleBackgroundReady &&
      video.duration > 0 &&
      video.duration - video.currentTime <= DAY_STREAK_IDLE_BACKGROUND_LEAD_TIME / 1000
    ) {
      setIdleBackgroundReady(true);
    }
    if (!contentReady && video.duration > 0 && video.duration - video.currentTime <= DAY_STREAK_UI_EARLY_REVEAL / 1000) {
      revealContent();
    }
  };

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[70] overflow-hidden bg-[#F08608] transition-[opacity,transform] duration-[360ms] ease-[cubic-bezier(0.85,0,0.15,1)] lg:hidden",
        phase === "closing" ? "pointer-events-none scale-[0.98] opacity-0" : "scale-100 opacity-100",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={calendarOpen ? t("dayStreak.calendarTitle") : t("dayStreak.title")}
      data-mobile-day-streak-menu
      data-mobile-day-streak-phase={phase}
      data-day-streak-content-ready={contentReady}
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
        onTimeUpdate={handleVideoTimeUpdate}
        onEnded={finishOpeningVideo}
        onError={finishOpeningVideo}
        aria-hidden="true"
        data-day-streak-background
        className="day-streak-opening-background absolute inset-0 h-full w-full object-cover"
      />
      <video
        ref={idleVideoRef}
        src={DAY_STREAK_IDLE_BACKGROUND_SOURCE}
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        data-day-streak-idle-background
        className={cn(
          "day-streak-idle-background absolute inset-0 h-full w-full object-cover transition-opacity duration-[580ms] ease-linear",
          idleBackgroundReady ? "opacity-100" : "opacity-0",
        )}
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
                  {streak}
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
                      className="relative isolate flex min-w-0 flex-col items-center gap-2"
                      data-day-streak-day={day.key}
                    >
                      <span
                        className={cn(
                          "relative z-20 inline-flex shrink-0 whitespace-nowrap text-xs font-semibold uppercase leading-none text-white/90",
                          superWater && "font-super-water",
                        )}
                        data-day-streak-weekday={day.key}
                      >
                        {formatSuperWaterText(locale, shortWeekday(day.date, locale))}
                      </span>
                      <span
                        className={cn(
                          "relative -top-8 inline-flex size-10 items-center justify-center rounded-full border-4 border-white bg-[#303030] text-white transition-colors sm:size-12",
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
            "relative -top-8 z-40 mx-auto grid w-full max-w-[32rem] grid-cols-2 gap-3 pointer-events-auto",
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
