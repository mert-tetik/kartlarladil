"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject, type SyntheticEvent } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n/locale-provider";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";
import { getTargetForStep, type TutorialTarget } from "@/features/tutorial/tutorial-targets";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT = 1023;
const SPOTLIGHT_PADDING = 18;
const VIEWPORT_GAP = 16;
const CALLOUT_WIDTH = 332;
const MESSAGE_HEIGHT = 96;
const NEXT_BUTTON_HEIGHT = 56;
const NEXT_BUTTON_GAP = 12;
const CALLOUT_TARGET_GAP = 68;
const CALLOUT_VERTICAL_LIFT = 16;
const TUTORIAL_START_DELAY_MS = 700;
const WELCOME_EXIT_DURATION_MS = 220;

const STEP_MESSAGE_KEYS = [
  "tutorial.landingDrawRandom",
  "tutorial.landingCreateCustom",
  "tutorial.landingCards",
  "tutorial.landingStartLearning",
  "tutorial.landingReviewLearned",
  "tutorial.landingRank",
  "tutorial.landingLeaderboard",
  "tutorial.landingGames",
  "tutorial.landingAiPractice",
] as const;

const RECTANGULAR_TARGETS = new Set<TutorialTarget["key"]>([
  "landing-card-center",
  "start-learning",
  "repeat-learned",
]);

interface SpotlightPosition {
  target: TutorialTarget;
  shape: "circle" | "rectangle";
  left: number;
  top: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius: number;
  calloutTop: number;
  arrowStartY: number;
  arrowEndY: number;
}

export function LandingTutorial() {
  const pathname = usePathname();
  const t = useT();
  const active = useTutorialStore((state) => state.active);
  const completed = useTutorialStore((state) => state.completed);
  const introSeen = useTutorialStore((state) => state.introSeen);
  const step = useTutorialStore((state) => state.step);
  const testMode = useTutorialStore((state) => state.testMode);
  const begin = useTutorialStore((state) => state.begin);
  const advance = useTutorialStore((state) => state.advance);
  const reset = useTutorialStore((state) => state.reset);
  const enableTestMode = useTutorialStore((state) => state.enableTestMode);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT,
  );
  const [position, setPosition] = useState<SpotlightPosition | null>(null);
  const [isWelcomeExiting, setIsWelcomeExiting] = useState(false);
  const [tutorialStartReady, setTutorialStartReady] = useState(false);
  const [isSubscriptionOfferVisible, setIsSubscriptionOfferVisible] = useState(() => isSubscriptionOfferOpen());
  const nextButtonRef = useRef<HTMLButtonElement | null>(null);
  const welcomeButtonRef = useRef<HTMLButtonElement | null>(null);
  const welcomeExitTimerRef = useRef<number | null>(null);
  const isVisible = testMode || (active && !completed);
  const isTutorialStarting = isVisible && !tutorialStartReady;
  const shouldShowWelcome = isVisible && tutorialStartReady && !introSeen;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if ((params.get("tutorial-test") === "1" || params.get("tutorial-debug") === "1") && !testMode) {
      reset();
      enableTestMode();
    }
  }, [enableTestMode, pathname, reset, testMode]);

  useEffect(() => {
    const updateSubscriptionOfferVisibility = () => {
      const visible = isSubscriptionOfferOpen();
      setIsSubscriptionOfferVisible((current) => (current === visible ? current : visible));
    };
    const observer = new MutationObserver(updateSubscriptionOfferVisibility);

    observer.observe(document.body, { childList: true, subtree: true });
    updateSubscriptionOfferVisibility();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || !isMobile || isSubscriptionOfferVisible || pathname !== "/") {
      setTutorialStartReady(false);
      return;
    }

    setTutorialStartReady(false);
    const startTimer = window.setTimeout(() => setTutorialStartReady(true), TUTORIAL_START_DELAY_MS);

    return () => window.clearTimeout(startTimer);
  }, [isMobile, isSubscriptionOfferVisible, isVisible, pathname]);

  const updatePosition = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
    setIsMobile(mobile);

    const state = useTutorialStore.getState();
    const shouldRender = state.testMode || (state.active && !state.completed);
    const target = getTargetForStep(state.step, window.location.pathname);

    if (!mobile || !shouldRender || !target) {
      setPosition(null);
      return;
    }

    const element = findVisibleElement(target.selector);
    if (!element) {
      setPosition(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = Math.hypot(rect.width, rect.height) / 2 + SPOTLIGHT_PADDING;
    const shape = RECTANGULAR_TARGETS.has(target.key) ? "rectangle" : "circle";
    const left = shape === "rectangle" ? rect.left - SPOTLIGHT_PADDING : centerX - radius;
    const top = shape === "rectangle" ? rect.top - SPOTLIGHT_PADDING : centerY - radius;
    const width = shape === "rectangle" ? rect.width + SPOTLIGHT_PADDING * 2 : radius * 2;
    const height = shape === "rectangle" ? rect.height + SPOTLIGHT_PADDING * 2 : radius * 2;
    const calloutHeight = MESSAGE_HEIGHT + NEXT_BUTTON_GAP + NEXT_BUTTON_HEIGHT;
    const isCalloutBelowTarget = centerY <= viewportHeight / 2;
    const preferredCalloutTop = isCalloutBelowTarget
      ? clamp(top + height + CALLOUT_TARGET_GAP, VIEWPORT_GAP, viewportHeight - calloutHeight - VIEWPORT_GAP)
      : clamp(top - calloutHeight - CALLOUT_TARGET_GAP, VIEWPORT_GAP, viewportHeight - calloutHeight - VIEWPORT_GAP);
    const calloutTop = clamp(
      preferredCalloutTop - CALLOUT_VERTICAL_LIFT,
      VIEWPORT_GAP,
      viewportHeight - calloutHeight - VIEWPORT_GAP,
    );
    const calloutBottom = calloutTop + calloutHeight;

    setPosition({
      target,
      shape,
      left,
      top,
      width,
      height,
      centerX,
      centerY,
      radius,
      calloutTop,
      arrowStartY: isCalloutBelowTarget ? calloutTop - 8 : calloutBottom + 8,
      arrowEndY: isCalloutBelowTarget ? top + height + 5 : top - 5,
    });
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(updatePosition);
    const timerIds = [100, 250, 600].map((delay) => window.setTimeout(updatePosition, delay));
    const observer = new MutationObserver(updatePosition);

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "aria-hidden"],
      childList: true,
      subtree: true,
    });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      timerIds.forEach((timerId) => window.clearTimeout(timerId));
      observer.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [active, completed, step, pathname, testMode, updatePosition]);

  useEffect(() => {
    if (shouldShowWelcome && !isWelcomeExiting) {
      welcomeButtonRef.current?.focus({ preventScroll: true });
      return;
    }

    if (position) {
      nextButtonRef.current?.focus({ preventScroll: true });
    }
  }, [isWelcomeExiting, position, shouldShowWelcome, step]);

  useEffect(() => () => {
    if (welcomeExitTimerRef.current !== null) {
      window.clearTimeout(welcomeExitTimerRef.current);
    }
  }, []);

  if (!isVisible || !isMobile || isSubscriptionOfferVisible || pathname !== "/") {
    return null;
  }

  if (isTutorialStarting) {
    return <TutorialStartScreen />;
  }

  function handleBeginTutorial() {
    if (isWelcomeExiting) return;

    setIsWelcomeExiting(true);
    welcomeExitTimerRef.current = window.setTimeout(() => {
      begin();
      setIsWelcomeExiting(false);
      welcomeExitTimerRef.current = null;
    }, WELCOME_EXIT_DURATION_MS);
  }

  if (shouldShowWelcome) {
    return (
      <WelcomeTutorialScreen
        exiting={isWelcomeExiting}
        label={t("tutorial.welcome")}
        nextLabel={t("tutorial.next")}
        nextButtonRef={welcomeButtonRef}
        onNext={handleBeginTutorial}
      />
    );
  }

  if (!position) {
    return null;
  }

  const mask = `radial-gradient(circle ${position.radius}px at ${position.centerX}px ${position.centerY}px, transparent ${Math.max(0, position.radius - 1)}px, #000 ${position.radius}px)`;
  const buttonLabel = step === STEP_MESSAGE_KEYS.length - 1 ? t("tutorial.understood") : t("tutorial.next");

  function blockUnderlyingInteraction(event: SyntheticEvent) {
    const target = event.target as Element;
    if (!target.closest("[data-landing-tutorial-next], [data-landing-tutorial-welcome-next]")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  return (
    <div
      data-landing-tutorial
      role="dialog"
      aria-modal="true"
      aria-label={t(STEP_MESSAGE_KEYS[step] ?? STEP_MESSAGE_KEYS[0])}
      className="fixed inset-0 z-[200] touch-none"
      onPointerDownCapture={blockUnderlyingInteraction}
      onClickCapture={blockUnderlyingInteraction}
      onWheelCapture={blockUnderlyingInteraction}
    >
      {position.shape === "circle" ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black/80"
          style={{ maskImage: mask, WebkitMaskImage: mask } as CSSProperties}
        />
      ) : (
        <>
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="fixed left-0 right-0 top-0 bg-black/80" style={{ height: position.top }} />
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="fixed left-0 bg-black/80" style={{ top: position.top, width: position.left, height: position.height }} />
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="fixed right-0 bg-black/80" style={{ top: position.top, left: position.left + position.width, height: position.height }} />
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="fixed bottom-0 left-0 right-0 bg-black/80" style={{ top: position.top + position.height }} />
        </>
      )}
      <div
        aria-hidden="true"
        data-landing-tutorial-spotlight
        data-spotlight-shape={position.shape}
        className={cn(
          "pointer-events-none fixed border-[5px] border-red-500 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_28px_rgba(239,68,68,0.55)] transition-[left,top,width,height,border-radius] duration-500 ease-out motion-reduce:transition-none",
          position.shape === "circle" ? "rounded-full" : "rounded-lg",
        )}
        style={{
          left: position.left,
          top: position.top,
          width: position.width,
          height: position.height,
        }}
      />
      <TutorialArrow key={`arrow-${step}`} position={position} />
      <div
        key={`callout-${step}`}
        data-landing-tutorial-callout
        className="tutorial-callout-enter fixed z-20 transition-[top] duration-500 ease-out motion-reduce:transition-none"
        style={{
          left: "50%",
          top: position.calloutTop,
          width: `min(${CALLOUT_WIDTH}px, calc(100vw - ${VIEWPORT_GAP * 2}px))`,
          transform: "translateX(-50%)",
        }}
      >
        <Image
          aria-hidden="true"
          alt=""
          data-tutorial-callout-mascot
          className="pointer-events-none absolute -left-3 top-8 z-10 h-auto w-24"
          height={512}
          priority
          src="/mascots/mascot5.webp"
          width={512}
        />
        <p
          data-landing-tutorial-message
          className="relative z-20 ml-20 flex h-24 items-center rounded-lg bg-white px-4 py-3 text-center text-base font-semibold leading-snug text-brand shadow-sm before:absolute before:-left-4 before:bottom-5 before:h-8 before:w-4 before:bg-white before:[clip-path:polygon(100%_0,100%_100%,0_50%)]"
        >
          {t(STEP_MESSAGE_KEYS[step] ?? STEP_MESSAGE_KEYS[0])}
        </p>
        <button
          ref={nextButtonRef}
          type="button"
          data-landing-tutorial-next
          onClick={advance}
          className="relative z-20 ml-20 mt-3 h-14 w-[calc(100%-5rem)] rounded-lg bg-brand text-base font-bold text-brand-foreground shadow-sm transition-[background-color,transform] hover:bg-brand-hover active:scale-[0.98] focus:outline-none focus-visible:outline-none"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function WelcomeTutorialScreen({
  exiting,
  label,
  nextLabel,
  nextButtonRef,
  onNext,
}: {
  exiting: boolean;
  label: string;
  nextLabel: string;
  nextButtonRef: RefObject<HTMLButtonElement | null>;
  onNext: () => void;
}) {
  return (
    <div
      data-landing-tutorial
      data-landing-tutorial-welcome
      role="dialog"
      aria-label={label}
      aria-modal="true"
      aria-busy={exiting}
      className={cn(
        "fixed inset-0 z-[200] flex min-h-[100dvh] touch-none items-center justify-center bg-black/80 px-6 text-center backdrop-blur-[2px]",
        exiting ? "tutorial-welcome-exit" : "tutorial-welcome-enter",
      )}
    >
      <div data-tutorial-welcome-content className="tutorial-welcome-content flex w-full max-w-sm flex-col items-center">
        <Image
          alt=""
          aria-hidden="true"
          data-tutorial-welcome-mascot
          className="h-auto w-full max-w-[19rem] object-contain"
          height={720}
          priority
          src="/mascots/mascot1.webp"
          width={720}
        />
        <h2 className="mt-4 text-3xl font-bold text-white">{label}</h2>
        <button
          ref={nextButtonRef}
          type="button"
          data-landing-tutorial-welcome-next
          disabled={exiting}
          onClick={onNext}
          className="mt-8 h-14 w-full max-w-64 rounded-lg bg-brand text-base font-bold text-brand-foreground shadow-sm transition-[background-color,opacity,transform] hover:bg-brand-hover active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:outline-none"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

function TutorialStartScreen() {
  return (
    <div
      aria-busy="true"
      aria-label="Starting tutorial"
      data-landing-tutorial-starting
      role="status"
      className="fixed inset-0 z-[200] min-h-[100dvh] touch-none bg-transparent"
    />
  );
}

function TutorialArrow({ position }: { position: SpotlightPosition }) {
  const controlY = position.arrowStartY + (position.arrowEndY - position.arrowStartY) / 2;
  const path = [
    `M ${position.centerX} ${position.arrowStartY}`,
    `C ${position.centerX} ${controlY}, ${position.centerX} ${controlY}, ${position.centerX} ${position.arrowEndY}`,
  ].join(" ");

  return (
    <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-10 h-full w-full text-red-500" focusable="false">
      <defs>
        <marker
          id="landing-tutorial-arrowhead"
          markerHeight="22"
          markerUnits="userSpaceOnUse"
          markerWidth="22"
          orient="auto"
          refX="0"
          refY="11"
          viewBox="0 0 22 22"
        >
          <path d="M 0 0 L 22 11 L 0 22 z" fill="currentColor" />
        </marker>
      </defs>
      <path
        className="tutorial-arrow-path"
        d={path}
        fill="none"
        markerEnd="url(#landing-tutorial-arrowhead)"
        pathLength="1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="8"
      />
    </svg>
  );
}

function isSubscriptionOfferOpen() {
  return typeof document !== "undefined" && document.querySelector("[data-mobile-subscription-offer]") !== null;
}

function findVisibleElement(selector: string) {
  return Array.from(document.querySelectorAll(selector)).find((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    for (let current: Element | null = element; current; current = current.parentElement) {
      const style = window.getComputedStyle(current);
      if (current.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden") {
        return false;
      }
    }

    return true;
  }) ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
