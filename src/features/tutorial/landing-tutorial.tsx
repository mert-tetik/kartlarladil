"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useT } from "@/i18n/locale-provider";
import type { TranslationKey, TranslationValues } from "@/i18n/dictionaries";
import { isTutorialVisibleState, useTutorialStore } from "@/features/tutorial/tutorial-store";
import {
  dispatchTutorialCardLayerClosed,
  dispatchTutorialCardLayerOpened,
  type TutorialLayerOrigin,
} from "@/features/tutorial/tutorial-card-session";
import { getTargetForStep, getTutorialStep, type TutorialTarget } from "@/features/tutorial/tutorial-targets";
import { cn } from "@/lib/utils";
import { canUseSuperWater, formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";

const MOBILE_BREAKPOINT = 1023;
const SPOTLIGHT_PADDING = 18;
const VIEWPORT_GAP = 16;
const CALLOUT_WIDTH = 332;
const MESSAGE_HEIGHT = 96;
const TUTORIAL_START_DELAY_MS = 700;
const SCREEN_TRANSITION_MS = 1000;
const SCREEN_SCROLL_DELAY_MS = 400;
const ORIGIN_SCREEN_ENTER_MS = 650;
const ORIGIN_SCREEN_CLOSE_TOTAL_MS = 860;
const LAYER_MESSAGE_VISIBLE_MS = 1500;
const WELCOME_EXIT_DURATION_MS = ORIGIN_SCREEN_CLOSE_TOTAL_MS;

const TUTORIAL_CHOICES = [
  {
    key: "random",
    selector: '[data-tutorial-target="landing-draw-cards"]',
    layer: "draw-cards",
    icon: "/card-icons/draw_cards_button.png",
    titleKey: "tutorial.cardModes.random.title",
    descriptionKey: "tutorial.cardModes.random.description",
  },
  {
    key: "custom",
    selector: '[data-tutorial-target="landing-create-card"]',
    layer: "custom-card",
    icon: "/card-icons/add_custom_card_button.png",
    titleKey: "tutorial.cardModes.custom.title",
    descriptionKey: "tutorial.cardModes.custom.description",
  },
  {
    key: "groups",
    selector: '[data-tutorial-target="landing-card-groups"]',
    layer: "card-groups",
    icon: "/card-icons/add_cards_with_groups.png",
    titleKey: "tutorial.cardModes.groups.title",
    descriptionKey: "tutorial.cardModes.groups.description",
  },
] as const;

interface SpotlightPosition {
  target: TutorialTarget;
  shape: "rectangle" | "circle";
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

type TutorialPhase = "visible" | "transition" | "layer-wait" | "layer-message" | "layer";

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
  const complete = useTutorialStore((state) => state.complete);
  const reset = useTutorialStore((state) => state.reset);
  const enableTestMode = useTutorialStore((state) => state.enableTestMode);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT);
  const [position, setPosition] = useState<SpotlightPosition | null>(null);
  const [phase, setPhase] = useState<TutorialPhase>("visible");
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [isWelcomeExiting, setIsWelcomeExiting] = useState(false);
  const [isChoiceExiting, setIsChoiceExiting] = useState(false);
  const [isTargetExiting, setIsTargetExiting] = useState(false);
  const [isMessageExiting, setIsMessageExiting] = useState(false);
  const [isLayerMessageExiting, setIsLayerMessageExiting] = useState(false);
  const [layerOrigin, setLayerOrigin] = useState<TutorialLayerOrigin>({ x: 0, y: 0 });
  const [tutorialStartReady, setTutorialStartReady] = useState(false);
  const [isSubscriptionOfferVisible, setIsSubscriptionOfferVisible] = useState(() => isSubscriptionOfferOpen());
  const welcomeExitTimerRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const phaseRef = useRef<TutorialPhase>("visible");
  const layerRef = useRef<string | null>(null);
  const layerMessageTimerRef = useRef<number | null>(null);
  const layerMessageCloseTimerRef = useRef<number | null>(null);
  const allowProgrammaticTargetClickRef = useRef(false);
  const targetTransitionStartedRef = useRef(false);
  const completionStartedRef = useRef(false);
  const testModeUrlHandledRef = useRef(false);
  const isVisible = isTutorialVisibleState({ active, completed, testMode });
  const isTutorialStarting = isVisible && !tutorialStartReady;
  const currentStep = getTutorialStep(step);
  const shouldShowWelcome = isVisible && tutorialStartReady && !introSeen && phase === "visible";

  function updatePhase(nextPhase: TutorialPhase) {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }

  function updateActiveLayer(nextLayer: string | null) {
    layerRef.current = nextLayer;
    setActiveLayer(nextLayer);
  }

  const clearTutorialTimers = useCallback(() => {
    if (welcomeExitTimerRef.current !== null) window.clearTimeout(welcomeExitTimerRef.current);
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
    if (layerMessageTimerRef.current !== null) window.clearTimeout(layerMessageTimerRef.current);
    if (layerMessageCloseTimerRef.current !== null) window.clearTimeout(layerMessageCloseTimerRef.current);
    welcomeExitTimerRef.current = null;
    transitionTimerRef.current = null;
    scrollTimerRef.current = null;
    layerMessageTimerRef.current = null;
    layerMessageCloseTimerRef.current = null;
  }, []);

  const startInvisibleTransition = useCallback((options?: { scrollToTopAfterMs?: number; onComplete?: () => void }) => {
    updatePhase("transition");
    setPosition(null);
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);

    if (options?.scrollToTopAfterMs !== undefined) {
      scrollTimerRef.current = window.setTimeout(() => {
        document.querySelector<HTMLElement>("[data-mobile-landing-dashboard]")?.scrollTo({ top: 0, behavior: "smooth" });
      }, options.scrollToTopAfterMs);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      if (!options?.onComplete) {
        advance();
      }
      updateActiveLayer(null);
      if (options?.onComplete) {
        options.onComplete();
      } else {
        updatePhase("visible");
      }
      transitionTimerRef.current = null;
    }, SCREEN_TRANSITION_MS);
  }, [advance]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isTestUrl = params.get("tutorial-test") === "1" || params.get("tutorial-debug") === "1";
    if (isTestUrl && !testModeUrlHandledRef.current) {
      testModeUrlHandledRef.current = true;
      reset();
      enableTestMode();
    }
  }, [enableTestMode, pathname, reset]);

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
      // This effect also resets the tutorial's transient UI when the route/auth layer changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTutorialStartReady(false);
      updatePhase("visible");
      updateActiveLayer(null);
      targetTransitionStartedRef.current = false;
      completionStartedRef.current = false;
      setIsWelcomeExiting(false);
      setIsChoiceExiting(false);
      setIsTargetExiting(false);
      setIsMessageExiting(false);
      setIsLayerMessageExiting(false);
      clearTutorialTimers();
      return;
    }

    setTutorialStartReady(false);
    const startTimer = window.setTimeout(() => setTutorialStartReady(true), TUTORIAL_START_DELAY_MS);
    return () => window.clearTimeout(startTimer);
  }, [clearTutorialTimers, isMobile, isSubscriptionOfferVisible, isVisible, pathname]);

  const updatePosition = useCallback(() => {
    const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
    setIsMobile(mobile);
    const state = useTutorialStore.getState();
    const shouldRender = isTutorialVisibleState(state);
    const target = getTargetForStep(state.step, window.location.pathname);
    if (!mobile || !shouldRender || phaseRef.current !== "visible" || !target) {
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
    const shape = target.key === "landing-card-center" || target.key === "start-learning" ? "rectangle" : "circle";
    const left = shape === "rectangle" ? rect.left - SPOTLIGHT_PADDING : centerX - radius;
    const top = shape === "rectangle" ? rect.top - SPOTLIGHT_PADDING : centerY - radius;
    const width = shape === "rectangle" ? rect.width + SPOTLIGHT_PADDING * 2 : radius * 2;
    const height = shape === "rectangle" ? rect.height + SPOTLIGHT_PADDING * 2 : radius * 2;
    const isCalloutBelowTarget = centerY <= viewportHeight / 2;
    const preferredCalloutTop = isCalloutBelowTarget
      ? clamp(top + height + 42, VIEWPORT_GAP, viewportHeight - MESSAGE_HEIGHT - VIEWPORT_GAP)
      : clamp(top - MESSAGE_HEIGHT - 42, VIEWPORT_GAP, viewportHeight - MESSAGE_HEIGHT - VIEWPORT_GAP);
    const calloutTop = clamp(preferredCalloutTop - 8, VIEWPORT_GAP, viewportHeight - MESSAGE_HEIGHT - VIEWPORT_GAP);
    const calloutBottom = calloutTop + MESSAGE_HEIGHT;

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
      arrowStartY: isCalloutBelowTarget ? calloutBottom + 8 : calloutTop - 8,
      arrowEndY: isCalloutBelowTarget ? top + height + 5 : top - 5,
    });
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(updatePosition);
    const timerIds = [100, 250, 600].map((delay) => window.setTimeout(updatePosition, delay));
    const observer = new MutationObserver(updatePosition);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class", "style", "aria-hidden"], childList: true, subtree: true });
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
  }, [active, completed, pathname, step, testMode, updatePosition]);

  useEffect(() => {
    if (phase !== "layer-wait" || !activeLayer) return;
    const getOpenLayer = () => Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial-layer="${activeLayer}"]`)).find((element) => {
      if (element.getAttribute("aria-hidden") === "true") return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    }) ?? null;
    const checkLayer = () => {
      if (getOpenLayer()) updatePhase("layer-message");
    };
    const observer = new MutationObserver(checkLayer);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    checkLayer();
    return () => observer.disconnect();
  }, [activeLayer, phase]);

  useEffect(() => {
    if (phase !== "layer-message" || !activeLayer) return;

    layerMessageTimerRef.current = window.setTimeout(() => {
      setIsLayerMessageExiting(true);
      layerMessageCloseTimerRef.current = window.setTimeout(() => {
        setIsLayerMessageExiting(false);
        updatePhase("layer");
        layerMessageCloseTimerRef.current = null;
      }, ORIGIN_SCREEN_CLOSE_TOTAL_MS);
      layerMessageTimerRef.current = null;
    }, ORIGIN_SCREEN_ENTER_MS + LAYER_MESSAGE_VISIBLE_MS);

    return () => {
      if (layerMessageTimerRef.current !== null) window.clearTimeout(layerMessageTimerRef.current);
      if (layerMessageCloseTimerRef.current !== null) window.clearTimeout(layerMessageCloseTimerRef.current);
      layerMessageTimerRef.current = null;
      layerMessageCloseTimerRef.current = null;
    };
  }, [activeLayer, phase]);

  useEffect(() => {
    if (phase !== "layer" || !activeLayer) return;
    let hasBeenOpen = false;
    let closeScheduled = false;
    const getOpenLayer = () => Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial-layer="${activeLayer}"]`)).find((element) => {
      if (element.getAttribute("aria-hidden") === "true") return false;
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden";
    }) ?? null;
    const checkLayer = () => {
      if (getOpenLayer()) {
        hasBeenOpen = true;
        return;
      }
      if (hasBeenOpen && !closeScheduled) {
        closeScheduled = true;
        dispatchTutorialCardLayerClosed({ layer: activeLayer as "draw-cards" | "custom-card" | "card-groups" });
        updateActiveLayer(null);
        startInvisibleTransition();
      }
    };
    const observer = new MutationObserver(checkLayer);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });
    checkLayer();
    return () => observer.disconnect();
  }, [activeLayer, phase, startInvisibleTransition]);

  useEffect(() => {
    if (!isVisible || !isMobile || isSubscriptionOfferVisible || pathname !== "/") return;

    const allowTarget = (element: Element | null) => {
      if (!element) return false;
      if (element.closest("[data-tutorial-pricing-link]")) return true;
      if (phaseRef.current === "transition") return false;
      if (phaseRef.current === "layer") {
        const layer = layerRef.current;
        return Boolean(layer && (element.closest(`[data-tutorial-layer="${layer}"]`) || element.closest(`[data-tutorial-layer-portal="${layer}"]`)));
      }
      if (phaseRef.current === "layer-wait" || phaseRef.current === "layer-message") return false;
      if (shouldShowWelcome) return Boolean(element.closest("[data-landing-tutorial-welcome-next]"));
      if (phaseRef.current === "visible" && currentStep?.mode === "choice") return Boolean(element.closest("[data-landing-tutorial-choice]"));
      if (phaseRef.current === "visible" && currentStep?.mode === "message") return Boolean(element.closest("[data-landing-tutorial-next]"));
      if (phaseRef.current === "visible" && currentStep?.mode === "target" && currentStep.selector) return Boolean(element.closest(currentStep.selector));
      return false;
    };
    const getElement = (event: Event) => event.target instanceof Element ? event.target : document.activeElement;
    const blockEvent = (event: Event) => {
      if (event.type === "keydown" && (event as KeyboardEvent).key === "Escape" && phaseRef.current === "layer") return;
      if (event.type === "click" && allowProgrammaticTargetClickRef.current) return;
      if (allowTarget(getElement(event))) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const eventNames = ["pointerdown", "pointerup", "pointermove", "touchstart", "touchmove", "wheel", "click", "contextmenu", "keydown"];
    eventNames.forEach((name) => document.addEventListener(name, blockEvent, true));
    return () => eventNames.forEach((name) => document.removeEventListener(name, blockEvent, true));
  }, [currentStep, isMobile, isSubscriptionOfferVisible, isVisible, pathname, shouldShowWelcome]);

  useEffect(() => {
    if (!isVisible || !isMobile || isSubscriptionOfferVisible || pathname !== "/") return;
    const handleTargetClick = (event: MouseEvent) => {
      if (allowProgrammaticTargetClickRef.current) {
        allowProgrammaticTargetClickRef.current = false;
        return;
      }
      if (phaseRef.current !== "visible") return;
      const element = event.target instanceof Element ? event.target : null;
      const current = getTutorialStep(useTutorialStore.getState().step);
      if (!element || current?.mode !== "target" || !current.selector || !element.closest(current.selector)) return;
      if (isTargetExiting) return;

      if (current.key === "landing-card-center") {
        if (targetTransitionStartedRef.current) return;
        targetTransitionStartedRef.current = true;
        setIsTargetExiting(true);
        transitionTimerRef.current = window.setTimeout(() => {
          updatePhase("transition");
          setPosition(null);
          startInvisibleTransition();
          setIsTargetExiting(false);
          targetTransitionStartedRef.current = false;
        }, ORIGIN_SCREEN_CLOSE_TOTAL_MS);
      } else if (current.key === "start-learning") {
        if (completionStartedRef.current) return;
        completionStartedRef.current = true;
        // Complete in this click turn. The real button starts navigation in
        // its React handler, and a pathname change must not cancel completion.
        complete();
      }
    };
    document.addEventListener("click", handleTargetClick);
    return () => document.removeEventListener("click", handleTargetClick);
  }, [complete, isMobile, isSubscriptionOfferVisible, isTargetExiting, isVisible, pathname, startInvisibleTransition]);

  if (!isVisible || !isMobile || isSubscriptionOfferVisible || pathname !== "/") return null;
  if (isTutorialStarting) return <TutorialStartScreen />;

  function handleBeginTutorial() {
    if (isWelcomeExiting) return;
    setIsWelcomeExiting(true);
    welcomeExitTimerRef.current = window.setTimeout(() => {
      begin();
      setIsWelcomeExiting(false);
      updatePhase("transition");
      setPosition(null);
      transitionTimerRef.current = window.setTimeout(() => {
        updatePhase("visible");
        transitionTimerRef.current = null;
      }, SCREEN_TRANSITION_MS);
      welcomeExitTimerRef.current = null;
    }, WELCOME_EXIT_DURATION_MS);
  }

  function handleChoice(choice: (typeof TUTORIAL_CHOICES)[number]) {
    if (phaseRef.current !== "visible" || isChoiceExiting) return;
    const target = findVisibleElement(choice.selector);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setLayerOrigin(origin);
    setIsChoiceExiting(true);
    setPosition(null);
    transitionTimerRef.current = window.setTimeout(() => {
      startInvisibleTransition({
        onComplete: () => {
          const targetElement = findVisibleElement(choice.selector) as HTMLElement | null;
          if (!targetElement) {
            setIsChoiceExiting(false);
            updatePhase("visible");
            return;
          }
          allowProgrammaticTargetClickRef.current = true;
          try {
            targetElement.click();
          } finally {
            window.setTimeout(() => { allowProgrammaticTargetClickRef.current = false; }, 0);
          }
          updateActiveLayer(choice.layer);
          dispatchTutorialCardLayerOpened({ layer: choice.layer, origin });
          setIsChoiceExiting(false);
          updatePhase("layer-wait");
        },
      });
    }, ORIGIN_SCREEN_CLOSE_TOTAL_MS);
  }

  function handleMessageContinue() {
    if (phaseRef.current !== "visible" || isMessageExiting) return;
    setIsMessageExiting(true);
    transitionTimerRef.current = window.setTimeout(() => {
      setIsMessageExiting(false);
      startInvisibleTransition({ scrollToTopAfterMs: SCREEN_SCROLL_DELAY_MS });
    }, ORIGIN_SCREEN_CLOSE_TOTAL_MS);
  }

  if (shouldShowWelcome) return <WelcomeTutorialScreen exiting={isWelcomeExiting} origin={{ x: window.innerWidth / 2, y: window.innerHeight / 2 }} label={t("tutorial.welcome")} description={t("tutorial.welcomeDescription")} nextLabel={t("tutorial.next")} onNext={handleBeginTutorial} />;
  if (phase === "transition") return <TutorialTransitionScreen />;
  if (phase === "layer-wait") return <TutorialTransitionScreen />;
  if (phase === "layer-message") return <TutorialLayerMessageScreen message={t("tutorial.cardCollectionPrompt")} origin={layerOrigin} exiting={isLayerMessageExiting} />;
  if (phase === "layer") return null;
  if (currentStep?.mode === "choice") return <TutorialChoiceScreen exiting={isChoiceExiting} origin={{ x: window.innerWidth / 2, y: window.innerHeight / 2 }} title={t("tutorial.cardModes.title")} choices={TUTORIAL_CHOICES} t={t} onChoice={handleChoice} />;
  if (currentStep?.mode === "message") return <TutorialMessageScreen exiting={isMessageExiting} origin={{ x: window.innerWidth / 2, y: window.innerHeight / 2 }} message={t((currentStep.messageKey ?? "tutorial.landingCardsMessage") as TranslationKey)} nextLabel={t("tutorial.next")} onNext={handleMessageContinue} />;
  if (!position || !currentStep?.messageKey) return null;

  const mask = `radial-gradient(circle ${position.radius}px at ${position.centerX}px ${position.centerY}px, transparent ${Math.max(0, position.radius - 1)}px, #000 ${position.radius}px)`;
  return (
    <div data-landing-tutorial data-landing-tutorial-phase="target" role="dialog" aria-modal="true" aria-label={t(currentStep.messageKey as TranslationKey)} className={cn("tutorial-origin-overlay pointer-events-none fixed inset-0 z-[1000]", isTargetExiting && "tutorial-origin-overlay--closing")} style={{ transformOrigin: `${position.centerX}px ${position.centerY}px` }}>
      {position.shape === "circle" ? <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/80" style={{ maskImage: mask, WebkitMaskImage: mask } as CSSProperties} /> : (
        <>
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="pointer-events-none fixed left-0 right-0 top-0 bg-black/80" style={{ height: position.top }} />
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="pointer-events-none fixed left-0 bg-black/80" style={{ top: position.top, width: position.left, height: position.height }} />
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="pointer-events-none fixed right-0 bg-black/80" style={{ top: position.top, left: position.left + position.width, height: position.height }} />
          <div aria-hidden="true" data-landing-tutorial-rect-mask className="pointer-events-none fixed bottom-0 left-0 right-0 bg-black/80" style={{ top: position.top + position.height }} />
        </>
      )}
      <div aria-hidden="true" data-landing-tutorial-spotlight data-spotlight-shape={position.shape} className={cn("pointer-events-none fixed border-[5px] border-red-500 shadow-[0_0_0_1px_rgba(255,255,255,0.15),0_0_28px_rgba(239,68,68,0.55)] transition-[left,top,width,height,border-radius] duration-500 ease-[cubic-bezier(0.85,0,0.15,1)] motion-reduce:transition-none", position.shape === "circle" ? "rounded-full" : "rounded-lg")} style={{ left: position.left, top: position.top, width: position.width, height: position.height }} />
      <TutorialArrow position={position} />
      <div key={`callout-${step}`} className="pointer-events-none fixed z-20" style={{ left: "50%", top: position.calloutTop, width: `min(${CALLOUT_WIDTH}px, calc(100vw - ${VIEWPORT_GAP * 2}px))`, transform: "translateX(-50%)" }}>
        <div data-landing-tutorial-callout className="tutorial-origin-overlay__item" style={{ animationDelay: isTargetExiting ? "0ms" : "520ms" }}>
          <Image aria-hidden="true" alt="" data-tutorial-callout-mascot className="pointer-events-none absolute -left-3 top-8 z-10 h-auto w-24" height={512} priority src="/mascots/mascot5.webp" width={512} />
          <p data-landing-tutorial-message className="relative z-20 ml-20 flex h-24 items-center rounded-lg bg-white px-4 py-3 text-center text-base font-semibold leading-snug text-brand shadow-sm before:absolute before:-left-4 before:bottom-5 before:h-8 before:w-4 before:bg-white before:[clip-path:polygon(100%_0,100%_100%,0_50%)]">{t(currentStep.messageKey as TranslationKey)}</p>
        </div>
      </div>
    </div>
  );
}

function WelcomeTutorialScreen({ exiting, origin, label, description, nextLabel, onNext }: { exiting: boolean; origin: TutorialLayerOrigin; label: string; description: string; nextLabel: string; onNext: () => void }) {
  const { locale } = useLocale();
  const useSuperWater = canUseSuperWater(locale);

  return (
    <div data-landing-tutorial data-landing-tutorial-welcome role="dialog" aria-label={label} aria-modal="true" aria-busy={exiting} className={cn("tutorial-origin-overlay fixed inset-0 z-[1000] flex min-h-[100dvh] touch-none items-center justify-center bg-black/80 px-6 text-center", exiting && "tutorial-origin-overlay--closing")} style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}>
      <div data-tutorial-welcome-content className="tutorial-origin-overlay__item flex w-full max-w-sm flex-col items-center" style={{ animationDelay: exiting ? "0ms" : "520ms" }}>
        <Image alt="" aria-hidden="true" data-tutorial-welcome-mascot className="h-auto w-full max-w-[19rem] object-contain" height={720} priority src="/mascots/mascot1.webp" width={720} />
        <h2 className={cn("mt-4 text-3xl font-bold text-white", useSuperWater && "font-super-water")}>
          {formatSuperWaterText(locale, label)}
        </h2>
        <p data-tutorial-welcome-description className="mt-4 max-w-[19rem] text-base font-semibold leading-relaxed text-white/90">{description}</p>
        <button type="button" data-landing-tutorial-welcome-next disabled={exiting} onClick={onNext} className="mt-8 h-14 w-full max-w-64 rounded-lg bg-brand text-base font-bold text-brand-foreground shadow-sm transition-[background-color,opacity,transform] duration-300 hover:bg-brand-hover active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:outline-none">{nextLabel}</button>
      </div>
    </div>
  );
}

function TutorialChoiceScreen({ exiting, origin, title, choices, t, onChoice }: { exiting: boolean; origin: TutorialLayerOrigin; title: string; choices: readonly (typeof TUTORIAL_CHOICES)[number][]; t: (key: TranslationKey, variables?: TranslationValues) => string; onChoice: (choice: (typeof TUTORIAL_CHOICES)[number]) => void }) {
  const { locale } = useLocale();
  const useSuperWater = canUseSuperWater(locale);
  const displayText = (text: string) => formatSuperWaterText(locale, text);

  return (
    <div data-landing-tutorial data-landing-tutorial-choice-screen role="dialog" aria-modal="true" aria-label={title} className={cn("tutorial-origin-overlay fixed inset-0 z-[1000] flex min-h-[100dvh] flex-col overflow-hidden bg-background px-4 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground", exiting && "tutorial-origin-overlay--closing")} style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}>
      <h2 className={cn("tutorial-origin-overlay__item shrink-0 py-3 text-center text-4xl font-bold text-foreground", useSuperWater && "font-super-water")} style={{ animationDelay: exiting ? "210ms" : "520ms" }}>
        {formatSuperWaterUppercaseText(locale, title)}
      </h2>
      <div className="grid min-h-0 flex-1 grid-rows-3 gap-3 py-3">
        {choices.map((choice, index) => <button key={choice.key} type="button" disabled={exiting} data-landing-tutorial-choice data-tutorial-choice={choice.key} onClick={() => onChoice(choice)} className={cn(
          "tutorial-origin-overlay__item group flex min-h-0 w-full items-center gap-4 rounded-2xl border border-transparent px-5 text-left shadow-sm transition-[transform,filter] duration-500 ease-[cubic-bezier(0.85,0,0.15,1)] active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none",
          choice.key === "random" && "bg-[#f59e0b] text-[#3b2a1c]",
          choice.key === "custom" && "bg-[#c026d3] text-white",
          choice.key === "groups" && "bg-[#84cc16] text-[#26341b]",
        )} style={{ animationDelay: exiting ? `${(3 - index) * 70}ms` : `${590 + index * 70}ms` }}>
          <Image src={choice.icon} alt="" aria-hidden="true" width={76} height={76} className="size-[clamp(3.5rem,18vw,5rem)] shrink-0 object-contain transition-transform duration-500 ease-[cubic-bezier(0.85,0,0.15,1)] group-hover:scale-105" />
          <span className="min-w-0"><span className={cn("block text-3xl font-bold leading-none", useSuperWater && "font-super-water")}>{displayText(t(choice.titleKey))}</span><span className={cn("mt-1 block text-xl font-medium leading-tight opacity-80", useSuperWater && "font-super-water")}>{displayText(t(choice.descriptionKey))}</span></span>
        </button>)}
      </div>
    </div>
  );
}

function TutorialMessageScreen({ exiting, origin, message, nextLabel, onNext }: { exiting: boolean; origin: TutorialLayerOrigin; message: string; nextLabel: string; onNext: () => void }) {
  return (
    <div data-landing-tutorial data-landing-tutorial-message-screen role="dialog" aria-modal="true" aria-label={message} className={cn("tutorial-origin-overlay fixed inset-0 z-[1000] flex min-h-[100dvh] items-center justify-center bg-black/80 px-5 text-center backdrop-blur-[2px]", exiting && "tutorial-origin-overlay--closing")} style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}>
      <div className="tutorial-origin-overlay__item flex w-full max-w-[22rem] flex-col items-center" style={{ animationDelay: exiting ? "0ms" : "520ms" }}><div className="relative w-full pl-16"><Image aria-hidden="true" alt="" data-tutorial-callout-mascot className="pointer-events-none absolute -left-1 top-8 z-10 h-auto w-24" height={512} priority src="/mascots/mascot5.webp" width={512} /><p data-landing-tutorial-message className="relative z-20 flex min-h-28 items-center rounded-lg bg-white px-4 py-4 text-center text-base font-semibold leading-snug text-brand shadow-sm before:absolute before:-left-4 before:bottom-5 before:h-8 before:w-4 before:bg-white before:[clip-path:polygon(100%_0,100%_100%,0_50%)]">{message}</p></div><button type="button" data-landing-tutorial-next onClick={onNext} disabled={exiting} className="mt-5 h-14 w-[calc(100%-4rem)] rounded-lg bg-brand text-base font-bold text-brand-foreground shadow-sm transition-[background-color,transform] duration-300 hover:bg-brand-hover active:scale-[0.98] disabled:pointer-events-none focus:outline-none focus-visible:outline-none">{nextLabel}</button></div>
    </div>
  );
}

function TutorialLayerMessageScreen({ message, origin, exiting }: { message: string; origin: TutorialLayerOrigin; exiting: boolean }) {
  return (
    <div data-testid="tutorial-layer-message" data-landing-tutorial data-landing-tutorial-layer-message-screen role="dialog" aria-modal="true" aria-label={message} aria-busy={exiting} className={cn("tutorial-origin-overlay fixed inset-0 z-[1000] flex min-h-[100dvh] items-center justify-center bg-black/80 px-5 text-center backdrop-blur-[2px]", exiting && "tutorial-origin-overlay--closing")} style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}>
      <div className="tutorial-origin-overlay__item flex w-full max-w-[22rem] items-center justify-center" style={{ animationDelay: exiting ? "0ms" : "520ms" }}>
        <div className="relative w-full pl-16">
          <Image aria-hidden="true" alt="" data-tutorial-callout-mascot className="pointer-events-none absolute -left-1 top-8 z-10 h-auto w-24" height={512} priority src="/mascots/mascot5.webp" width={512} />
          <p data-landing-tutorial-layer-message className="relative z-20 flex min-h-28 items-center rounded-lg bg-white px-4 py-4 text-center text-base font-semibold leading-snug text-brand shadow-sm before:absolute before:-left-4 before:bottom-5 before:h-8 before:w-4 before:bg-white before:[clip-path:polygon(100%_0,100%_100%,0_50%)]">{message}</p>
        </div>
      </div>
    </div>
  );
}

function TutorialTransitionScreen() {
  return <div data-landing-tutorial data-landing-tutorial-transition aria-busy="true" aria-hidden="true" className="fixed inset-0 z-[1000] min-h-[100dvh] touch-none bg-transparent" />;
}

function TutorialStartScreen() {
  return <div aria-busy="true" aria-label="Starting tutorial" data-landing-tutorial-starting role="status" className="fixed inset-0 z-[1000] min-h-[100dvh] touch-none bg-transparent" />;
}

function TutorialArrow({ position }: { position: SpotlightPosition }) {
  const controlY = position.arrowStartY + (position.arrowEndY - position.arrowStartY) / 2;
  const path = `M ${position.centerX} ${position.arrowStartY} C ${position.centerX} ${controlY}, ${position.centerX} ${controlY}, ${position.centerX} ${position.arrowEndY}`;
  return <svg aria-hidden="true" className="pointer-events-none fixed inset-0 z-10 h-full w-full text-red-500" focusable="false"><defs><marker id="landing-tutorial-arrowhead" markerHeight="22" markerUnits="userSpaceOnUse" markerWidth="22" orient="auto" refX="0" refY="11" viewBox="0 0 22 22"><path d="M 0 0 L 22 11 L 0 22 z" fill="currentColor" /></marker></defs><path className="tutorial-arrow-path" d={path} fill="none" markerEnd="url(#landing-tutorial-arrowhead)" pathLength="1" stroke="currentColor" strokeLinecap="round" strokeWidth="8" /></svg>;
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
      if (current.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden") return false;
    }
    return true;
  }) ?? null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
