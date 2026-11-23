import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizLeaderboardProgressView } from "@/features/quiz/components/quiz-leaderboard-progress-view";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { LeaderboardEntry, LeaderboardPayload } from "@/features/leaderboard/leaderboard-types";
import { getRankForPoints } from "@/features/progress/progress-stats";
import { playSoundEffect } from "@/lib/sound-effects";

vi.mock("@/lib/sound-effects", () => ({ playSoundEffect: vi.fn() }));

type TestAnimation = {
  finished: Promise<void>;
  finish: () => void;
  cancel: () => void;
};

let animations: Array<{ element: HTMLElement; frames: Keyframe[]; animation: TestAnimation }>;
let rafCallbacks: Array<{ id: number; callback: FrameRequestCallback }>;
let nextRafId: number;
let initialScrollAtEntryStart: number | null;
let rowsAtEntryStart: number;
let originalAnimate: PropertyDescriptor | undefined;
let originalRect: PropertyDescriptor | undefined;
let originalClientHeight: PropertyDescriptor | undefined;
let originalScrollHeight: PropertyDescriptor | undefined;
let originalOffsetHeight: PropertyDescriptor | undefined;
let originalOffsetTop: PropertyDescriptor | undefined;
let originalOffsetParent: PropertyDescriptor | undefined;
let originalMatchMedia: PropertyDescriptor | undefined;
let originalRequestAnimationFrame: PropertyDescriptor | undefined;
let originalCancelAnimationFrame: PropertyDescriptor | undefined;

const entries: LeaderboardEntry[] = [
  createEntry("first", 1, 500, false),
  createEntry("viewer", 2, 400, true),
  createEntry("third", 3, 300, false),
  createEntry("fourth", 4, 200, false),
];

const payload: LeaderboardPayload = {
  mode: "points",
  viewer: {
    userId: "viewer",
    position: 2,
    pointsPosition: 2,
    streakPosition: 1,
    medalsPosition: 1,
    displayName: "Learner",
    totalPoints: 400,
    streak: 1,
    medals: 3,
    leaderboardVisible: true,
  },
  entries,
  canViewLeaderboard: true,
};

function createEntry(userId: string, position: number, totalPoints: number, isViewer: boolean): LeaderboardEntry {
  return {
    userId,
    position,
    displayName: isViewer ? "Learner" : `Player ${position}`,
    profilePictureIndex: null,
    totalPoints,
    streak: 0,
    medals: 0,
    rankIcon: getRankForPoints(totalPoints).icon,
    isViewer,
  };
}

function renderView({
  onComplete = vi.fn(),
  forceMotion = false,
  previousViewerPoints = 100,
}: {
  onComplete?: () => void;
  forceMotion?: boolean;
  previousViewerPoints?: number | null;
} = {}) {
  const view = render(
    <LocaleProvider initialLocale="en">
      <QuizLeaderboardProgressView
        payload={payload}
        loading={false}
        beforePosition={4}
        previousViewerPoints={previousViewerPoints}
        forceMotion={forceMotion}
        onComplete={onComplete}
      />
    </LocaleProvider>,
  );
  return { ...view, onComplete };
}

function finishAnimation(index: number) {
  const animation = animations[index]?.animation;
  if (!animation) throw new Error(`Animation ${index} was not started`);
  animation.finish();
}

function advanceFrame(timestamp: number) {
  const callbacks = rafCallbacks;
  rafCallbacks = [];
  callbacks.forEach(({ callback }) => callback(timestamp));
}

beforeEach(() => {
  animations = [];
  rafCallbacks = [];
  nextRafId = 0;
  initialScrollAtEntryStart = null;
  rowsAtEntryStart = 0;
  originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  originalRect = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getBoundingClientRect");
  originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
  originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  originalOffsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop");
  originalOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetParent");
  originalMatchMedia = Object.getOwnPropertyDescriptor(window, "matchMedia");
  originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(window, "requestAnimationFrame");
  originalCancelAnimationFrame = Object.getOwnPropertyDescriptor(window, "cancelAnimationFrame");
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value(this: HTMLElement, frames: Keyframe[] | PropertyIndexedKeyframes) {
      if (this.hasAttribute("data-quiz-leaderboard-progress")) {
        const list = this.querySelector<HTMLElement>("[data-leaderboard-list]");
        initialScrollAtEntryStart = list?.scrollTop ?? null;
        rowsAtEntryStart = list?.querySelectorAll("[data-leaderboard-entry-key]").length ?? 0;
      }
      let resolveFinished!: () => void;
      const animation: TestAnimation = {
        finished: new Promise<void>((resolve) => {
          resolveFinished = resolve;
        }),
        finish: () => {
          const lastFrame = Array.isArray(frames) ? frames[frames.length - 1] as Keyframe | undefined : undefined;
          if (typeof lastFrame?.transform === "string") this.style.transform = lastFrame.transform;
          resolveFinished();
        },
        cancel: () => resolveFinished(),
      };
      animations.push({ element: this, frames: frames as Keyframe[], animation });
      return animation as unknown as Animation;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value(this: HTMLElement) {
      const animatedRoot = this.closest<HTMLElement>("[data-quiz-leaderboard-progress]");
      if (animatedRoot?.style.transform === "scale(0)" && (
        this.hasAttribute("data-leaderboard-list") || this.hasAttribute("data-leaderboard-entry-key")
      )) {
        return {
          x: 0,
          y: 0,
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        } as DOMRect;
      }
      if (this.hasAttribute("data-leaderboard-list")) {
        return {
          x: 0,
          y: 0,
          top: 0,
          bottom: 240,
          left: 0,
          right: 320,
          width: 320,
          height: 240,
          toJSON: () => ({}),
        } as DOMRect;
      }
      if (this.dataset.leaderboardEntryKey) {
        const siblings = Array.from(this.parentElement?.children ?? []);
        const list = this.closest<HTMLElement>("[data-leaderboard-list]");
        const top = Math.max(0, siblings.indexOf(this)) * 72 - (list?.scrollTop ?? 0);
        return {
          x: 0,
          y: top,
          top,
          bottom: top + 64,
          left: 0,
          right: 320,
          width: 320,
          height: 64,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("data-leaderboard-list") ? 240 : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("data-leaderboard-list") ? 1_000 : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("data-leaderboard-list")
        ? 240
        : this.hasAttribute("data-leaderboard-entry-key") ? 64 : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get(this: HTMLElement) {
      if (!this.hasAttribute("data-leaderboard-entry-key")) return 0;
      const siblings = Array.from(this.parentElement?.children ?? []);
      return Math.max(0, siblings.indexOf(this)) * 72;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("data-leaderboard-entry-key")
        ? this.closest<HTMLElement>("[data-leaderboard-list]")
        : null;
    },
  });
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value(callback: FrameRequestCallback) {
      const id = ++nextRafId;
      rafCallbacks.push({ id, callback });
      return id;
    },
  });
  Object.defineProperty(window, "cancelAnimationFrame", {
    configurable: true,
    value(id: number) {
      rafCallbacks = rafCallbacks.filter((task) => task.id !== id);
    },
  });
});

afterEach(() => {
  if (originalAnimate) {
    Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
  }
  if (originalRect) {
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", originalRect);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "getBoundingClientRect");
  }
  if (originalClientHeight) {
    Object.defineProperty(HTMLElement.prototype, "clientHeight", originalClientHeight);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  }
  if (originalScrollHeight) {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeight);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  }
  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
  }
  if (originalOffsetTop) {
    Object.defineProperty(HTMLElement.prototype, "offsetTop", originalOffsetTop);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "offsetTop");
  }
  if (originalOffsetParent) {
    Object.defineProperty(HTMLElement.prototype, "offsetParent", originalOffsetParent);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "offsetParent");
  }
  if (originalMatchMedia) {
    Object.defineProperty(window, "matchMedia", originalMatchMedia);
  } else {
    Reflect.deleteProperty(window, "matchMedia");
  }
  if (originalRequestAnimationFrame) {
    Object.defineProperty(window, "requestAnimationFrame", originalRequestAnimationFrame);
  } else {
    Reflect.deleteProperty(window, "requestAnimationFrame");
  }
  if (originalCancelAnimationFrame) {
    Object.defineProperty(window, "cancelAnimationFrame", originalCancelAnimationFrame);
  } else {
    Reflect.deleteProperty(window, "cancelAnimationFrame");
  }
  vi.useRealTimers();
});

describe("QuizLeaderboardProgressView", () => {
  it("floats the viewer row above the list into its new rank and stays visible before exiting", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.mocked(playSoundEffect).mockClear();
    const { onComplete } = renderView();
    const region = screen.getByRole("region", { name: "Leaderboard" });
    expect(animations).toHaveLength(1);
    const leaderboardList = region.querySelector<HTMLElement>("[data-leaderboard-list]");
    if (!leaderboardList) throw new Error("Expected the leaderboard list to render");
    expect(initialScrollAtEntryStart).toBe(128);
    expect(rowsAtEntryStart).toBe(entries.length);
    expect(leaderboardList.scrollTop).toBe(initialScrollAtEntryStart);
    expect(leaderboardList).toHaveStyle({ overflowAnchor: "none" });
    expect(leaderboardList).toHaveStyle({ overflowY: "hidden", touchAction: "none" });
    const initialScrollTop = leaderboardList.scrollTop;
    expect(region.querySelectorAll("[data-leaderboard-entry-key]")).toHaveLength(entries.length);
    const rowKeys = () => Array.from(
      region.querySelectorAll<HTMLElement>("[data-leaderboard-entry-key]"),
      (row) => row.dataset.leaderboardEntryKey,
    );
    const rowPosition = (userId: string) => region
      .querySelector<HTMLElement>(`[data-leaderboard-entry-key="${userId}"] [data-leaderboard-position-badge]`)
      ?.textContent;
    expect(rowKeys()).toEqual(["first", "third", "fourth", "viewer"]);
    expect(rowPosition("viewer")).toBe("4.");
    const firstRow = region.querySelector<HTMLElement>('[data-leaderboard-entry-key="first"]');
    const viewerRowAtStart = region.querySelector<HTMLElement>('[data-leaderboard-entry-key="viewer"]');
    expect(firstRow).toHaveClass("bg-[var(--quiz-leaderboard-row-color)]");
    expect(firstRow?.style.getPropertyValue("--quiz-leaderboard-row-color")).toContain("color-mix");
    expect(viewerRowAtStart).toHaveClass(
      "bg-[var(--quiz-leaderboard-row-color)]",
      "ring-2",
      "ring-[var(--quiz-leaderboard-rank-color)]",
    );
    expect(viewerRowAtStart?.style.getPropertyValue("--quiz-leaderboard-row-color")).toBe("#DD661D");
    expect(viewerRowAtStart?.style.getPropertyValue("--quiz-leaderboard-rank-color")).toBe("#DD661D");
    expect(viewerRowAtStart?.querySelector('[data-leaderboard-position-badge] img[src="/ranks/rank1.webp"]'))
      .toBeInTheDocument();

    await act(async () => {
      finishAnimation(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rowKeys()).toEqual(["first", "viewer", "third", "fourth"]);
    expect(rowPosition("viewer")).toBe("4.");
    expect(rowPosition("third")).toBe("2.");
    expect(rowPosition("fourth")).toBe("3.");
    expect(region).toHaveAttribute("data-transition-state", "moving");
    const viewerRow = region.querySelector<HTMLElement>('[data-leaderboard-entry="viewer"]');
    expect(viewerRow).toHaveStyle({ visibility: "hidden" });
    const trackedViewerFlight = region.querySelector<HTMLElement>('[data-leaderboard-rank-flight="true"]');
    expect(trackedViewerFlight).toBeInTheDocument();
    expect(trackedViewerFlight?.parentElement).toBe(leaderboardList);
    expect(viewerRow?.style.getPropertyValue("--quiz-leaderboard-rank-color")).toBe("#DD661D");
    expect(viewerRow?.querySelector('[data-leaderboard-position-badge] img[src="/ranks/rank1.webp"]'))
      .toBeInTheDocument();
    await act(async () => {
      advanceFrame(0);
      advanceFrame(750);
    });
    expect(leaderboardList.scrollTop).toBeLessThan(initialScrollTop);
    const flightTop = Number.parseFloat(trackedViewerFlight!.style.top);
    const scaleY = Number.parseFloat(trackedViewerFlight!.style.transform.match(/scale\([^,]+,\s*([^)]+)\)/)?.[1] ?? "1");
    const visualFlightHeight = 64 * scaleY;
    expect(Math.abs(
      flightTop - leaderboardList.scrollTop
      - (leaderboardList.clientHeight - visualFlightHeight) / 2,
    )).toBeLessThan(1.1);
    await act(async () => {
      advanceFrame(1_500);
    });
    const rowAnimationIndices = animations.slice(1).map((_, index) => index + 1);
    await act(async () => {
      rowAnimationIndices.forEach(finishAnimation);
      vi.advanceTimersByTime(1_550);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(region).toHaveAttribute("data-transition-state", "holding");
    expect(rowPosition("viewer")).toBe("2.");
    expect(rowPosition("third")).toBe("3.");
    expect(rowPosition("fourth")).toBe("4.");
    expect(region.querySelectorAll('[data-rank-position-pulse="true"]')).toHaveLength(3);
    expect(viewerRow?.style.getPropertyValue("--quiz-leaderboard-rank-color")).toBe("#F9B14C");
    expect(viewerRow?.querySelector('[data-leaderboard-position-badge] img[src="/ranks/rank2.webp"]'))
      .toBeInTheDocument();
    expect(viewerRow?.querySelector("[data-leaderboard-position-badge]")).toHaveClass(
      "animate-quiz-leaderboard-rank-pulse",
    );
    expect(viewerRow).toHaveClass("animate-quiz-leaderboard-viewer-row-rank-pulse");
    expect(playSoundEffect).toHaveBeenCalledExactlyOnceWith("quiz-completion-progress-pop", { playbackRate: 0.9 });
    expect(viewerRow).not.toHaveStyle({ visibility: "hidden" });
    expect(document.querySelector('[data-leaderboard-rank-flight="true"]')).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1_799);
    });
    expect(onComplete).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(region).toHaveAttribute("data-transition-state", "exiting");
    await act(async () => {
      finishAnimation(animations.length - 1);
      await Promise.resolve();
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("keeps the rank transition running when the list is tapped", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const { onComplete } = renderView();
    const region = screen.getByRole("region", { name: "Leaderboard" });
    expect(animations).toHaveLength(1);

    fireEvent.click(region);
    await act(async () => {
      finishAnimation(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(region).toHaveAttribute("data-transition-state", "moving");
    expect(animations.length).toBeGreaterThan(1);
    fireEvent.click(region);
    expect(region).toHaveAttribute("data-transition-state", "moving");
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("ignores a cancelled entry animation when the entry effect restarts", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const view = render(
      <LocaleProvider initialLocale="en">
        <QuizLeaderboardProgressView
          payload={payload}
          loading={false}
          beforePosition={4}
          forceMotion
          onComplete={vi.fn()}
        />
      </LocaleProvider>,
    );
    const region = screen.getByRole("region", { name: "Leaderboard" });

    // Changing the entry effect dependency cancels its first animation and
    // starts another while the visual stage is still entering.
    view.rerender(
      <LocaleProvider initialLocale="en">
        <QuizLeaderboardProgressView
          payload={payload}
          loading={false}
          beforePosition={4}
          forceMotion={false}
          onComplete={vi.fn()}
        />
      </LocaleProvider>,
    );
    expect(animations).toHaveLength(2);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(region).toHaveAttribute("data-transition-state", "entering");
    expect(document.querySelector('[data-leaderboard-rank-flight="true"]')).not.toBeInTheDocument();

    await act(async () => {
      finishAnimation(animations.length - 1);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(region).toHaveAttribute("data-transition-state", "moving");
    expect(document.querySelector('[data-leaderboard-rank-flight="true"]')).toBeInTheDocument();
  });

  it("forces the leaderboard preview animation even when reduced motion is preferred", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    const { container } = renderView({ forceMotion: true });
    await act(async () => {
      finishAnimation(0);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector("[data-position-transition='moving']")).toBeInTheDocument();
    expect(document.querySelector('[data-leaderboard-rank-flight="true"]')).toBeInTheDocument();
  });

  it("shows the localized rank-up title above a transparent leaderboard list", () => {
    renderView();
    const region = screen.getByRole("region", { name: "Leaderboard" });
    const list = region.querySelector("[data-leaderboard-list]");
    const divider = region.querySelector("[data-leaderboard-divider]");
    const title = screen.getByRole("heading", {
      level: 2,
      name: "YOU MOVED UP IN THE LEADERBOARD!",
    });
    const listContainer = list?.parentElement;

    expect(region).not.toHaveClass("bg-yellow-400");
    expect(region).not.toHaveStyle({ backgroundImage: "url('/leaderboard/points-background.webp')" });
    expect(region.querySelector("h1")).not.toBeInTheDocument();
    expect(title).toHaveClass("font-super-water", "text-4xl", "sm:text-5xl", "relative", "-top-7.5");
    expect(divider).toHaveClass("h-px", "bg-white");
    expect(divider?.nextElementSibling).toBe(list);
    expect(listContainer).toHaveClass("bottom-0");
    expect(listContainer).toHaveClass("overflow-visible");
    expect(listContainer).not.toHaveClass("bg-background-card");
    expect(listContainer).not.toHaveClass("border", "border-border");
    expect(listContainer).not.toHaveClass("shadow-sm");
  });
});
