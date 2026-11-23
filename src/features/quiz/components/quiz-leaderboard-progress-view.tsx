"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { LeaderboardEntriesList } from "@/features/leaderboard/components/leaderboard-entries-list";
import type { LeaderboardEntry, LeaderboardPayload } from "@/features/leaderboard/leaderboard-types";
import { getRankForPoints } from "@/features/progress/progress-stats";
import { useLocale, useT } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterUppercaseText } from "@/lib/super-water";
import { playSoundEffect } from "@/lib/sound-effects";
import { cn } from "@/lib/utils";
import { useQuizAnimationFastForward } from "@/features/quiz/components/quiz-animation-fast-forward";

const SCALE_DURATION_MS = 360;
const POSITION_TRANSITION_MS = 1_500;
const AUTO_ADVANCE_DELAY_MS = 1_800;
const LEADERBOARD_WAIT_LIMIT_MS = 1_800;
const RESULT_SCALE_EASING = "cubic-bezier(0.85, 0, 0.15, 1)";
const POSITION_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

type ProgressPhase = "entering" | "waiting-data" | "moving" | "holding" | "exiting" | "done";

interface RunningAnimation {
  finished: Promise<void>;
  finish: () => void;
  cancel: () => void;
}

interface RankFlightSnapshot {
  sourceRect: Pick<DOMRect, "top" | "left" | "width" | "height">;
  element: HTMLElement;
}

export function QuizLeaderboardProgressView({
  payload,
  loading,
  beforePosition,
  previousViewerPoints = null,
  forceMotion = false,
  onComplete,
}: {
  payload: LeaderboardPayload | null;
  loading: boolean;
  beforePosition: number | null;
  previousViewerPoints?: number | null;
  forceMotion?: boolean;
  onComplete: () => void;
}) {
  const { locale } = useLocale();
  const t = useT();
  const previousViewerRankIcon = typeof previousViewerPoints === "number"
    && Number.isFinite(previousViewerPoints)
    ? getRankForPoints(Math.max(0, previousViewerPoints)).icon
    : null;
  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<ProgressPhase>("entering");
  const latestPayloadRef = useRef<LeaderboardPayload | null>(payload);
  const [initialEntries] = useState(() => payload?.mode === "points"
    ? positionEntriesAtRank(
      payload.canViewLeaderboard ? payload.entries : [],
      payload.viewer.userId,
      beforePosition,
      previousViewerRankIcon,
    )
    : []);
  const displayedEntriesRef = useRef<LeaderboardEntry[]>(initialEntries);
  const hasInitialEntriesRef = useRef(payload?.mode === "points");
  const initialViewerScrollAppliedRef = useRef(false);
  const completionCalledRef = useRef(false);
  const entryAnimationRef = useRef<RunningAnimation | null>(null);
  const exitAnimationRef = useRef<RunningAnimation | null>(null);
  const rowAnimationsRef = useRef<RunningAnimation[]>([]);
  const rankFlightRef = useRef<RankFlightSnapshot | null>(null);
  const movementFallbackTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const waitLimitTimerRef = useRef<number | null>(null);
  const pendingFlipTopsRef = useRef<Map<string, number> | null>(null);
  const hiddenViewerRowRef = useRef<HTMLElement | null>(null);
  const movementFinalEntriesRef = useRef<LeaderboardEntry[]>([]);
  const [displayEntries, setDisplayEntries] = useState<LeaderboardEntry[]>(initialEntries);
  const [phase, setPhase] = useState<ProgressPhase>("entering");
  const [positionTransitionActive, setPositionTransitionActive] = useState(false);
  const [rankFlight, setRankFlight] = useState<RankFlightSnapshot | null>(null);
  const [rankPulseUserIds, setRankPulseUserIds] = useState<ReadonlySet<string>>(() => new Set());

  const updatePhase = useCallback((nextPhase: ProgressPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const finishScreen = useCallback(() => {
    if (completionCalledRef.current) return;
    completionCalledRef.current = true;
    updatePhase("done");
    onComplete();
  }, [onComplete, updatePhase]);

  const cleanupRankFlight = useCallback(() => {
    rankFlightRef.current?.element.remove();
    rankFlightRef.current = null;
    setRankFlight(null);
    hiddenViewerRowRef.current?.style.removeProperty("visibility");
    hiddenViewerRowRef.current = null;
  }, []);

  const beginExit = useCallback(() => {
    if (phaseRef.current === "exiting" || phaseRef.current === "done") return;
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    updatePhase("exiting");
    const root = rootRef.current;
    if (!root || (!forceMotion && prefersReducedMotion())) {
      finishScreen();
      return;
    }

    const animation = runTransformAnimation(root, "scale(1)", "scale(0)", SCALE_DURATION_MS, RESULT_SCALE_EASING);
    exitAnimationRef.current = animation;
    void animation.finished.then(() => {
      if (exitAnimationRef.current !== animation || phaseRef.current !== "exiting") return;
      exitAnimationRef.current = null;
      finishScreen();
    });
  }, [finishScreen, forceMotion, updatePhase]);

  const beginHold = useCallback(() => {
    if (phaseRef.current === "holding" || phaseRef.current === "exiting" || phaseRef.current === "done") return;
    updatePhase("holding");
    advanceTimerRef.current = window.setTimeout(beginExit, AUTO_ADVANCE_DELAY_MS);
  }, [beginExit, updatePhase]);

  const completeMovement = useCallback(() => {
    if (phaseRef.current !== "moving") return;
    if (movementFallbackTimerRef.current !== null) {
      window.clearTimeout(movementFallbackTimerRef.current);
      movementFallbackTimerRef.current = null;
    }
    rowAnimationsRef.current.forEach((animation) => animation.cancel());
    rowAnimationsRef.current = [];
    const finalEntries = movementFinalEntriesRef.current;
    const oldPositions = new Map(displayedEntriesRef.current.map((entry) => [entry.userId, entry.position]));
    const changedEntries = finalEntries.filter((entry) => oldPositions.get(entry.userId) !== entry.position);
    setRankPulseUserIds(new Set(changedEntries.map((entry) => entry.userId)));
    const viewerId = latestPayloadRef.current?.viewer.userId;
    if (changedEntries.some((entry) => entry.isViewer || entry.userId === viewerId)) {
      playSoundEffect("quiz-completion-progress-pop", { playbackRate: 0.9 });
    }
    displayedEntriesRef.current = [...finalEntries];
    setDisplayEntries([...finalEntries]);
    cleanupRankFlight();
    pendingFlipTopsRef.current = null;
    setPositionTransitionActive(false);
    beginHold();
  }, [beginHold, cleanupRankFlight]);

  const beginMovement = useCallback(() => {
    if (phaseRef.current !== "waiting-data") return;

    const latestPayload = latestPayloadRef.current;
    if (!latestPayload) {
      if (loading) return;
      beginHold();
      return;
    }

    const finalEntries = latestPayload.canViewLeaderboard ? latestPayload.entries : [];
    const currentEntries = displayedEntriesRef.current;
    const viewerId = latestPayload.viewer.userId;
    const viewerCurrentIndex = finalEntries.findIndex((entry) => entry.userId === viewerId || entry.isViewer);
    const currentViewerIndex = currentEntries.findIndex((entry) => entry.userId === viewerId || entry.isViewer);
    const hasMovement = viewerCurrentIndex >= 0 && currentViewerIndex >= 0 && viewerCurrentIndex !== currentViewerIndex;

    if (!hasMovement) {
      displayedEntriesRef.current = [...finalEntries];
      setDisplayEntries([...finalEntries]);
      beginHold();
      return;
    }

    const viewerEntry = currentEntries.find((entry) => entry.userId === viewerId || entry.isViewer);
    const priorViewerRankIcon = previousViewerRankIcon ?? viewerEntry?.rankIcon;
    const list = listRef.current;
    const viewerRow = listRef.current?.querySelector<HTMLElement>(
      '[data-leaderboard-entry="viewer"]',
    );
    if (viewerEntry && viewerRow && list) {
      const { top, left, width, height } = viewerRow.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      const flightElement = viewerRow.cloneNode(true) as HTMLElement;
      flightElement.dataset.leaderboardRankFlight = "true";
      flightElement.removeAttribute("data-leaderboard-entry");
      flightElement.removeAttribute("data-leaderboard-entry-key");
      flightElement.setAttribute("aria-hidden", "true");
      flightElement.inert = true;
      Object.assign(flightElement.style, {
        position: "absolute",
        top: `${top - listRect.top - list.clientTop + list.scrollTop}px`,
        left: `${left - listRect.left - list.clientLeft + list.scrollLeft}px`,
        width: `${width}px`,
        height: `${height}px`,
        margin: "0",
        zIndex: "2147483647",
        pointerEvents: "none",
        transformOrigin: "top left",
        willChange: "transform",
        boxShadow: "0 4px 8px rgb(0 0 0 / 32%)",
      });
      flightElement.style.setProperty("--leaderboard-hue", "#facc15");
      list.appendChild(flightElement);
      const snapshot = { sourceRect: { top, left, width, height }, element: flightElement };
      rankFlightRef.current = snapshot;
      setRankFlight(snapshot);
    }

    const oldTops = new Map<string, number>();
    const firstAffectedIndex = Math.min(viewerCurrentIndex, currentViewerIndex);
    const lastAffectedIndex = Math.max(viewerCurrentIndex, currentViewerIndex);
    listRef.current?.querySelectorAll<HTMLElement>("[data-leaderboard-entry-key]").forEach((row, index) => {
      if (index < firstAffectedIndex || index > lastAffectedIndex) return;
      const key = row.dataset.leaderboardEntryKey;
      if (key) oldTops.set(key, row.getBoundingClientRect().top);
    });

    const previousPositions = new Map(currentEntries.map((entry) => [entry.userId, entry.position]));
    const movementEntries = finalEntries.map((entry) => {
      const isViewer = entry.userId === viewerId || entry.isViewer;
      return {
        ...entry,
        position: previousPositions.get(entry.userId) ?? entry.position,
        rankIcon: isViewer ? priorViewerRankIcon ?? entry.rankIcon : entry.rankIcon,
      };
    });
    pendingFlipTopsRef.current = oldTops;
    movementFinalEntriesRef.current = [...finalEntries];
    displayedEntriesRef.current = movementEntries;
    setRankPulseUserIds(new Set());
    updatePhase("moving");
    setDisplayEntries(movementEntries);
  }, [beginHold, loading, previousViewerRankIcon, updatePhase]);

  const fastForwardCurrentAnimation = useCallback(() => {
    if (phaseRef.current === "entering" && entryAnimationRef.current) {
      entryAnimationRef.current.finish();
      return true;
    }

    if (phaseRef.current === "moving") {
      if (movementFallbackTimerRef.current !== null) {
        window.clearTimeout(movementFallbackTimerRef.current);
        movementFallbackTimerRef.current = null;
      }
      rowAnimationsRef.current.forEach((animation) => animation.finish());
      completeMovement();
      return true;
    }

    if (phaseRef.current === "exiting") {
      if (exitAnimationRef.current) exitAnimationRef.current.finish();
      else finishScreen();
      return true;
    }

    return false;
  }, [completeMovement, finishScreen]);

  useQuizAnimationFastForward(fastForwardCurrentAnimation, true, 100);

  const beginMovementRef = useRef(beginMovement);
  useLayoutEffect(() => {
    beginMovementRef.current = beginMovement;
  }, [beginMovement]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const previousOverflowAnchor = list.style.overflowAnchor;
    const previousOverflowY = list.style.overflowY;
    const previousTouchAction = list.style.touchAction;
    const previousPosition = list.style.position;
    list.style.overflowAnchor = "none";
    list.style.overflowY = "hidden";
    list.style.touchAction = "none";
    list.style.position = "relative";
    return () => {
      list.style.overflowAnchor = previousOverflowAnchor;
      list.style.overflowY = previousOverflowY;
      list.style.touchAction = previousTouchAction;
      list.style.position = previousPosition;
    };
  }, []);

  useLayoutEffect(() => {
    if (initialViewerScrollAppliedRef.current || !hasInitialEntriesRef.current) return;
    const list = listRef.current;
    const rows = Array.from(list?.querySelectorAll<HTMLElement>("[data-leaderboard-entry-key]") ?? []);
    if (!list || rows.length === 0) return;

    const viewerId = latestPayloadRef.current?.viewer.userId;
    const viewerIndex = displayedEntriesRef.current.findIndex(
      (entry) => entry.isViewer || entry.userId === viewerId,
    );
    const anchorRow = rows[Math.max(0, Math.min(rows.length - 1, viewerIndex))];
    if (!anchorRow) return;

    const anchorTop = getOffsetTopWithinContainer(anchorRow, list);
    if (anchorTop === null) return;

    const targetScrollTop = anchorTop - (list.clientHeight - anchorRow.offsetHeight) / 2;
    list.scrollTop = clamp(targetScrollTop, 0, list.scrollHeight - list.clientHeight);
    initialViewerScrollAppliedRef.current = true;
  }, [displayEntries]);

  useLayoutEffect(() => {
    const oldTops = pendingFlipTopsRef.current;
    if (!oldTops || phaseRef.current !== "moving") return;

    const renderedKeys = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[data-leaderboard-entry-key]") ?? [],
      (row) => row.dataset.leaderboardEntryKey,
    );
    const expectedKeys = displayedEntriesRef.current.map((entry) => entry.userId);
    if (
      renderedKeys.length !== expectedKeys.length ||
      renderedKeys.some((key, index) => key !== expectedKeys[index])
    ) {
      return;
    }

    pendingFlipTopsRef.current = null;

    const animations: RunningAnimation[] = [];
    const list = listRef.current;
    const finalViewerRow = list?.querySelector<HTMLElement>('[data-leaderboard-entry="viewer"]') ?? null;
    list?.querySelectorAll<HTMLElement>("[data-leaderboard-entry-key]").forEach((row) => {
      const key = row.dataset.leaderboardEntryKey;
      const oldTop = key ? oldTops.get(key) : undefined;
      if (oldTop === undefined) return;

      const offsetY = oldTop - row.getBoundingClientRect().top;
      const isViewerRow = row.dataset.leaderboardEntry === "viewer";
      if (isViewerRow) {
        if (rankFlight) {
          row.style.visibility = "hidden";
          hiddenViewerRowRef.current = row;
          return;
        }
      }
      if (Math.abs(offsetY) < 1) return;
      animations.push(runTransformAnimation(
        row,
        `translateY(${offsetY}px)`,
        "translateY(0)",
        POSITION_TRANSITION_MS,
        POSITION_EASING,
      ));
    });

    const flightElement = rankFlight?.element ?? null;
    if (rankFlight && flightElement && finalViewerRow && list) {
      const targetRect = finalViewerRow.getBoundingClientRect();
      animations.push(runTrackedRankFlightAnimation(
        flightElement,
        list,
        rankFlight.sourceRect,
        targetRect,
        POSITION_TRANSITION_MS,
        POSITION_EASING,
      ));
    }

    rowAnimationsRef.current = animations;
    setPositionTransitionActive(true);
    if (animations.length === 0) {
      completeMovement();
      return;
    }

    const movementStartedAt = Date.now();
    const completeAfterVisibleFlight = () => {
      if (phaseRef.current !== "moving") return;
      const remaining = POSITION_TRANSITION_MS - (Date.now() - movementStartedAt);
      if (remaining > 0) {
        if (movementFallbackTimerRef.current !== null) {
          window.clearTimeout(movementFallbackTimerRef.current);
        }
        movementFallbackTimerRef.current = window.setTimeout(completeMovement, remaining + 50);
      } else {
        completeMovement();
      }
    };
    movementFallbackTimerRef.current = window.setTimeout(
      completeMovement,
      POSITION_TRANSITION_MS + 150,
    );
    void Promise.all(animations.map((animation) => animation.finished)).then(completeAfterVisibleFlight);
  }, [completeMovement, displayEntries, rankFlight]);

  useEffect(() => {
    latestPayloadRef.current = payload;
    if (payload?.mode !== "points") return;

    const finalEntries = payload.canViewLeaderboard ? payload.entries : [];
    if (!hasInitialEntriesRef.current) {
      const initialEntries = positionEntriesAtRank(
        finalEntries,
        payload.viewer.userId,
        beforePosition,
        previousViewerRankIcon,
      );
      displayedEntriesRef.current = initialEntries;
      hasInitialEntriesRef.current = true;
      setDisplayEntries(initialEntries);
    } else if (["holding", "exiting"].includes(phaseRef.current)) {
      displayedEntriesRef.current = [...finalEntries];
      setDisplayEntries([...finalEntries]);
    }

    if (phaseRef.current === "waiting-data") {
      beginMovementRef.current();
    }
  }, [beforePosition, payload, previousViewerRankIcon]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const scheduleWaitFallback = () => {
      waitLimitTimerRef.current = window.setTimeout(() => {
        if (phaseRef.current !== "waiting-data") return;
        if (latestPayloadRef.current) {
          beginMovementRef.current();
        } else {
          beginHold();
        }
      }, LEADERBOARD_WAIT_LIMIT_MS);
    };

    if (!forceMotion && prefersReducedMotion()) {
      const frameId = window.requestAnimationFrame(() => {
        root.style.transform = "scale(1)";
        updatePhase("waiting-data");
        beginMovementRef.current();
      });
      scheduleWaitFallback();
      return () => {
        window.cancelAnimationFrame(frameId);
        if (waitLimitTimerRef.current !== null) window.clearTimeout(waitLimitTimerRef.current);
      };
    }

    root.style.transform = "scale(0)";
    const animation = runTransformAnimation(root, "scale(0)", "scale(1)", SCALE_DURATION_MS, RESULT_SCALE_EASING);
    entryAnimationRef.current = animation;
    void animation.finished.then(() => {
      // A cancelled animation also settles `finished`. In dev, React Strict
      // Mode intentionally runs effect cleanup/setup once on mount, so only
      // the currently-owned entry animation may advance the screen.
      if (entryAnimationRef.current !== animation || phaseRef.current !== "entering") return;
      entryAnimationRef.current = null;
      updatePhase("waiting-data");
      beginMovementRef.current();
    });

    scheduleWaitFallback();
    return () => {
      if (entryAnimationRef.current === animation) entryAnimationRef.current = null;
      animation.cancel();
      if (waitLimitTimerRef.current !== null) window.clearTimeout(waitLimitTimerRef.current);
    };
  }, [beginHold, forceMotion, updatePhase]);

  useEffect(() => {
    if (!loading && !payload && phaseRef.current === "waiting-data") {
      beginMovementRef.current();
    }
  }, [loading, payload]);

  useEffect(() => () => {
    if (movementFallbackTimerRef.current !== null) window.clearTimeout(movementFallbackTimerRef.current);
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    if (waitLimitTimerRef.current !== null) window.clearTimeout(waitLimitTimerRef.current);
    entryAnimationRef.current?.cancel();
    entryAnimationRef.current = null;
    exitAnimationRef.current?.cancel();
    exitAnimationRef.current = null;
    rowAnimationsRef.current.forEach((animation) => animation.cancel());
    rankFlightRef.current?.element.remove();
    rankFlightRef.current = null;
    hiddenViewerRowRef.current?.style.removeProperty("visibility");
  }, []);

  return (
    <section
      ref={rootRef}
      role="region"
      aria-label={t("leaderboard.title")}
      data-quiz-leaderboard-progress
      data-transition-state={phase}
      data-position-transition={positionTransitionActive ? "moving" : "idle"}
      data-no-tap-vibrate
      className="pointer-events-none absolute inset-0 z-50 h-full w-full overflow-hidden"
      style={{
        transform: "scale(0)",
        transformOrigin: "center",
      } as CSSProperties}
    >
      <div
        className="pointer-events-auto absolute inset-x-3 bottom-0 mx-auto flex h-[min(90dvh,calc(50dvh_+_24rem))] min-h-0 max-w-xl flex-col overflow-visible"
        style={{ "--leaderboard-hue": "#facc15" } as CSSProperties}
      >
        <h2
          className={cn(
            "relative -top-7.5 w-full shrink-0 px-2 pb-3 text-center text-4xl font-semibold leading-tight text-white sm:text-5xl",
            canUseSuperWater(locale) && "font-super-water",
          )}
        >
          {formatSuperWaterUppercaseText(locale, t("leaderboard.rankUpTitle"))}
        </h2>
        <div
          data-leaderboard-divider
          aria-hidden="true"
          className="h-px w-full shrink-0 bg-white"
        />
        <LeaderboardEntriesList
          data={payload}
          mode="points"
          loading={loading}
          error=""
          entries={displayEntries}
          pulsePositionForUserIds={rankPulseUserIds}
          listRef={listRef}
          rowPresentation="quiz-flow"
        />
      </div>
    </section>
  );
}

function positionEntriesAtRank(
  entries: readonly LeaderboardEntry[],
  viewerId: string,
  targetPosition: number | null,
  viewerRankIcon: LeaderboardEntry["rankIcon"] | null,
) {
  const ordered = [...entries];
  const viewerIndex = ordered.findIndex((entry) => entry.userId === viewerId || entry.isViewer);
  if (viewerIndex < 0 || targetPosition === null || !Number.isFinite(targetPosition)) return ordered;

  const [viewerEntry] = ordered.splice(viewerIndex, 1);
  const targetIndex = Math.min(ordered.length, Math.max(0, Math.round(targetPosition) - 1));
  ordered.splice(targetIndex, 0, viewerEntry);
  return ordered.map((entry, index) => ({
    ...entry,
    position: index + 1,
    rankIcon: (entry.isViewer || entry.userId === viewerId) && viewerRankIcon
      ? viewerRankIcon
      : entry.rankIcon,
  }));
}

function getOffsetTopWithinContainer(element: HTMLElement, container: HTMLElement) {
  let offsetTop = 0;
  let current: HTMLElement | null = element;

  while (current && current !== container) {
    offsetTop += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }

  return current === container ? offsetTop : null;
}

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function runTrackedRankFlightAnimation(
  element: HTMLElement,
  list: HTMLDivElement,
  sourceRect: RankFlightSnapshot["sourceRect"],
  targetRect: Pick<DOMRect, "top" | "left" | "width" | "height">,
  duration: number,
  easing: string,
): RunningAnimation {
  let frameId: number | null = null;
  let startTime: number | null = null;
  let settled = false;
  let resolveFinished!: () => void;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  const listRect = list.getBoundingClientRect();
  const listOriginTop = listRect.top + list.clientTop;
  const listOriginLeft = listRect.left + list.clientLeft;
  const startTop = sourceRect.top - listOriginTop + list.scrollTop;
  const endTop = targetRect.top - listOriginTop + list.scrollTop;
  const startLeft = sourceRect.left - listOriginLeft + list.scrollLeft;
  const endLeft = targetRect.left - listOriginLeft + list.scrollLeft;
  const scaleX = targetRect.width / Math.max(1, sourceRect.width);
  const scaleY = targetRect.height / Math.max(1, sourceRect.height);
  const lift = Math.min(52, Math.max(30, Math.abs(endTop - startTop) * 0.16));
  const viewportHeight = list.clientHeight || listRect.height;
  const maxScrollTop = Math.max(0, list.scrollHeight - viewportHeight);

  const applyProgress = (progress: number) => {
    const eased = easeCubicBezier(progress, easing);
    const arc = 4 * eased * (1 - eased);
    const top = startTop + (endTop - startTop) * eased - lift * arc;
    const left = startLeft + (endLeft - startLeft) * eased;
    const scalePulse = 0.16 * arc;
    const currentScaleY = 1 + (scaleY - 1) * eased + scalePulse;
    const visualRowHeight = sourceRect.height * currentScaleY;
    const centeredScrollTop = top - (viewportHeight - visualRowHeight) / 2;
    list.scrollTop = clamp(centeredScrollTop, 0, maxScrollTop);

    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
    element.style.transform = `scale(${1 + (scaleX - 1) * eased + scalePulse}, ${currentScaleY})`;
  };

  const settle = () => {
    if (settled) return;
    settled = true;
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    resolveFinished();
  };

  const tick = (timestamp: number) => {
    if (settled) return;
    if (startTime === null) startTime = timestamp;
    const elapsed = Math.max(0, timestamp - startTime);
    const progress = Math.min(1, elapsed / duration);
    applyProgress(progress);
    if (progress >= 1) {
      settle();
      return;
    }
    frameId = requestFrame(tick);
  };

  frameId = requestFrame(tick);
  return {
    finished,
    finish: () => {
      applyProgress(1);
      settle();
    },
    cancel: settle,
  };
}

function requestFrame(callback: FrameRequestCallback) {
  return typeof window.requestAnimationFrame === "function"
    ? window.requestAnimationFrame(callback)
    : window.setTimeout(() => callback(performance.now()), 16);
}

function cancelFrame(frameId: number) {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(frameId);
  } else {
    window.clearTimeout(frameId);
  }
}

function easeCubicBezier(progress: number, easing: string) {
  const match = easing.match(/cubic-bezier\(([^)]+)\)/);
  if (!match) return progress;
  const [x1, y1, x2, y2] = match[1].split(",").map(Number);
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const parameter = (low + high) / 2;
    if (cubicBezierCoordinate(parameter, x1, x2) < progress) low = parameter;
    else high = parameter;
  }
  return cubicBezierCoordinate((low + high) / 2, y1, y2);
}

function cubicBezierCoordinate(parameter: number, firstControl: number, secondControl: number) {
  const inverse = 1 - parameter;
  return 3 * inverse * inverse * parameter * firstControl
    + 3 * inverse * parameter * parameter * secondControl
    + parameter * parameter * parameter;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function runTransformAnimation(
  element: HTMLElement,
  from: string,
  to: string,
  duration: number,
  easing: string,
  middle?: string,
): RunningAnimation {
  if (typeof element.animate === "function") {
    const animation = element.animate(
      middle
        ? [{ transform: from }, { transform: middle, offset: 0.5 }, { transform: to }]
        : [{ transform: from }, { transform: to }],
      { duration, easing, fill: "both" },
    );
    const finished = animation.finished.then(() => undefined).catch(() => undefined);
    return {
      finished,
      finish: () => {
        try {
          animation.finish();
        } catch {
          // A cancelled animation may no longer have an active effect.
        }
      },
      cancel: () => animation.cancel(),
    };
  }

  let timer: number | null = null;
  let firstFrame: number | null = null;
  let secondFrame: number | null = null;
  const previousTransition = element.style.transition;
  let resolveFinished: (() => void) | null = null;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
    element.style.transition = "none";
    element.style.transform = from;
    void element.offsetWidth;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        element.style.transition = `transform ${duration}ms ${easing}`;
        element.style.transform = to;
        timer = window.setTimeout(resolve, duration);
      });
    });
  });

  const finish = () => {
    if (timer !== null) window.clearTimeout(timer);
    if (firstFrame !== null) window.cancelAnimationFrame(firstFrame);
    if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
    timer = null;
    firstFrame = null;
    secondFrame = null;
    element.style.transition = previousTransition;
    element.style.transform = to;
    resolveFinished?.();
  };
  return {
    finished,
    finish,
    cancel: () => {
      if (timer !== null) window.clearTimeout(timer);
      if (firstFrame !== null) window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
      timer = null;
      firstFrame = null;
      secondFrame = null;
      element.style.transition = previousTransition;
      resolveFinished?.();
    },
  };
}
