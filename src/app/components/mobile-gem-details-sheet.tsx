"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useAuthSession } from "@/features/auth/auth-client";
import { convertGemToPointsAction } from "@/features/gems/gem-actions";
import { GEM_ASSETS, GEM_POINTS, type GemType } from "@/features/gems/gem-types";
import { useProgressStats } from "@/features/progress/progress-client";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { playSoundEffect } from "@/lib/sound-effects";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { vibrate } from "@/lib/vibration";
import { cn } from "@/lib/utils";
import { ScoreIcon } from "@/components/score-icon";

const GEM_LABEL_KEYS = {
  blue: "gems.blueName",
  green: "gems.greenName",
  purple: "gems.purpleName",
} as const;
const GEM_DESCRIPTION_KEYS = {
  blue: "gems.blueDescription",
  green: "gems.greenDescription",
  purple: "gems.purpleDescription",
} as const;
const GEM_BUTTON_CLASSES = {
  blue: "bg-sky-500 shadow-[0_8px_0_rgb(2_132_199)]",
  green: "bg-emerald-500 shadow-[0_8px_0_rgb(4_120_87)]",
  purple: "bg-violet-500 shadow-[0_8px_0_rgb(109_40_217)]",
} as const;
const GEM_TEXT_CLASSES = {
  blue: "text-sky-400",
  green: "text-emerald-400",
  purple: "text-violet-400",
} as const;

interface MobileGemDetailsSheetProps {
  type: GemType | null;
  open: boolean;
  onClose: () => void;
  sourceRect?: DOMRect | null;
}

const CONTENT_ENTER_DELAY_MS = 520;
const CONTENT_STEP_MS = 70;
const CLOSE_ANIMATION_MS = 860;

export function MobileGemDetailsSheet({
  type,
  open,
  onClose,
  sourceRect = null,
}: MobileGemDetailsSheetProps) {
  const { locale } = useLocale();
  const t = useT();
  const { user, updateProfileField, refreshProfile } = useAuthSession();
  const { refreshStats } = useProgressStats();
  const [mounted, setMounted] = useState(false);
  const [displayedType, setDisplayedType] = useState<GemType | null>(type);
  const [presented, setPresented] = useState(Boolean(open && type));
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [queuedConversions, setQueuedConversions] = useState(0);
  const [flights, setFlights] = useState<Array<{ id: number; startX: number; startY: number; targetX: number; targetY: number }>>([]);
  const convertButtonRef = useRef<HTMLButtonElement>(null);
  const conversionQueueRef = useRef(0);
  const conversionRunningRef = useRef(false);
  const balanceRef = useRef(0);
  const gemPointsRef = useRef(0);
  const flightIdRef = useRef(0);
  const selectedType = type ?? displayedType;
  const balanceForType = selectedType === "blue"
    ? user?.profile.blueGems ?? 0
    : selectedType === "green"
      ? user?.profile.greenGems ?? 0
      : selectedType === "purple"
        ? user?.profile.purpleGems ?? 0
        : 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && type) {
      setDisplayedType(type);
      setPresented(true);
      setClosing(false);
      setEntered(false);
      const frame = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(frame);
    }

    if (!presented) return;

    setClosing(true);
    setEntered(false);
    const timer = window.setTimeout(() => {
      setPresented(false);
      setClosing(false);
      setDisplayedType(null);
    }, CLOSE_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [open, presented, sourceRect, type]);

  useEffect(() => {
    if (!presented) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, presented]);

  useEffect(() => {
    balanceRef.current = balanceForType;
    gemPointsRef.current = user?.profile.gemPoints ?? 0;
  }, [balanceForType, user?.profile.gemPoints]);

  if (!mounted || !presented || !selectedType || typeof document === "undefined") return null;
  const balance = balanceForType;
  const points = GEM_POINTS[selectedType];
  const availableToQueue = Math.max(0, balance - queuedConversions);
  const useSuperWater = canUseSuperWater(locale);
  const gemName = formatSuperWaterText(locale, t(GEM_LABEL_KEYS[selectedType]));
  const gemDescription = formatSuperWaterText(locale, t(GEM_DESCRIPTION_KEYS[selectedType]));
  const convertLabel = formatSuperWaterText(locale, t("gems.convert"));
  const conversionType = selectedType;
  const contentItemCount = 4;
  const origin = sourceRect
    ? {
        x: sourceRect.left + sourceRect.width / 2,
        y: sourceRect.top + sourceRect.height / 2,
      }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  function renderContentItem(index: number, children: ReactNode, className?: string) {
    return (
      <div
        className={cn("gem-details-overlay__item", className)}
        style={{
          animationDelay: closing
            ? `${(contentItemCount - index - 1) * CONTENT_STEP_MS}ms`
            : `${CONTENT_ENTER_DELAY_MS + index * CONTENT_STEP_MS}ms`,
        }}
      >
        {children}
      </div>
    );
  }

  async function drainConversionQueue() {
    if (conversionRunningRef.current) return;
    conversionRunningRef.current = true;
    setConverting(true);

    try {
      while (conversionQueueRef.current > 0) {
        if (!user || balanceRef.current < 1) {
          conversionQueueRef.current = 0;
          setQueuedConversions(0);
          break;
        }

        const result = await convertGemToPointsAction(conversionType);
        if (!result.success || !result.balances || !result.points) {
          conversionQueueRef.current = 0;
          setQueuedConversions(0);
          break;
        }

        conversionQueueRef.current -= 1;
        setQueuedConversions((current) => Math.max(0, current - 1));
        balanceRef.current = Math.max(0, balanceRef.current - 1);
        gemPointsRef.current += result.points;
        const source = convertButtonRef.current?.getBoundingClientRect();
        const target = document.querySelector<HTMLElement>("[data-mobile-main-points]")?.getBoundingClientRect();
        if (source && target) {
          const id = flightIdRef.current++;
          setFlights((current) => [...current, {
            id,
            startX: source.left + source.width / 2,
            startY: source.top + source.height / 2,
            targetX: target.left + target.width / 2,
            targetY: target.top + target.height / 2,
          }]);
        }

        updateProfileField({
          blueGems: result.balances.blue,
          greenGems: result.balances.green,
          purpleGems: result.balances.purple,
          gemPoints: gemPointsRef.current,
        });
        playSoundEffect("gem-spend");
        vibrate("tap");
        await Promise.all([refreshProfile(), refreshStats()]);
      }
    } finally {
      conversionRunningRef.current = false;
      setConverting(false);
    }
  }

  function handleConvert() {
    if (closing || !user || availableToQueue < 1) return;
    conversionQueueRef.current += 1;
    setQueuedConversions((current) => current + 1);
    vibrate("tap");
    void drainConversionQueue();
  }

  const content = (
    <div
      className={cn(
        "gem-details-overlay fixed inset-0 z-[90] flex items-center justify-center bg-transparent px-5 lg:hidden",
        !entered && !closing && "gem-details-overlay--preparing",
        closing && "gem-details-overlay--closing",
      )}
      style={{ transformOrigin: `${origin.x}px ${origin.y}px` }}
      role="dialog"
      aria-modal="true"
      aria-label={t("gems.detailsTitle")}
      data-mobile-gem-details
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "relative w-full max-w-[22rem] -translate-y-[2.25rem] pt-20",
        )}
      >
        <div className={cn(
          "relative flex min-h-[22rem] max-h-[calc(100dvh-2rem)] flex-col items-center justify-center overflow-y-auto rounded-[1.75rem] bg-background-card px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-24 text-center text-foreground shadow-[0_24px_70px_rgb(0_0_0_/_0.45)] ring-1 ring-black/10",
          "transition-transform duration-[260ms] ease-[cubic-bezier(0.85,0,0.15,1)]",
          closing || !entered ? "translate-y-5 scale-[0.96]" : "translate-y-0 scale-100",
        )}>
          {renderContentItem(
            0,
            <h2 className={cn("mt-1 w-full text-3xl font-bold leading-none", useSuperWater && "font-super-water")}>
              {gemName}
            </h2>,
            "w-full",
          )}
          {renderContentItem(
            1,
            <p className={cn("mt-2 w-full text-3xl font-bold leading-none", GEM_TEXT_CLASSES[selectedType], useSuperWater && "font-super-water")}>
              <span className="inline-flex items-center justify-center gap-1.5">
                {formatNumber(locale, balance)}
                <Image src={GEM_ASSETS[selectedType]} alt="" width={22} height={22} className="size-[22px] object-contain" />
              </span>
            </p>,
            "w-full",
          )}
          {renderContentItem(
            2,
            <p className={cn("mx-auto mt-4 w-full max-w-[18rem] text-sm leading-6 text-white", useSuperWater && "font-super-water")}>
              {gemDescription}
            </p>,
            "w-full",
          )}
          {renderContentItem(
            3,
            <button
              type="button"
              ref={convertButtonRef}
              data-gem-convert
              disabled={!user || availableToQueue < 1}
              onClick={handleConvert}
              className={cn(
                "mt-6 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-bold text-[var(--brand-foreground)] transition-transform active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45",
                GEM_BUTTON_CLASSES[selectedType],
                useSuperWater && "font-super-water",
                converting && "animate-pulse",
              )}
            >
              <span>{convertLabel}</span>
              <span className="inline-flex items-center gap-1 text-yellow-300">
                {points}
                <ScoreIcon size={18} />
              </span>
            </button>,
            "w-full",
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="gem-details-overlay__item absolute right-3 top-3 z-10 inline-flex size-10 items-center justify-center text-foreground-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
            style={{
              animationDelay: closing
                ? `${contentItemCount * CONTENT_STEP_MS}ms`
                : `${CONTENT_ENTER_DELAY_MS + contentItemCount * CONTENT_STEP_MS}ms`,
            }}
          >
            <X className="size-6 stroke-[3]" aria-hidden="true" />
          </button>
        </div>

        <div className="pointer-events-none absolute left-1/2 top-0 z-20 size-40 -translate-x-1/2">
          <Image
            src={GEM_ASSETS[selectedType]}
            alt=""
            width={160}
            height={160}
            className="size-40 object-contain drop-shadow-[0_16px_24px_rgb(0_0_0_/_0.35)]"
          />
        </div>
      </div>

      {flights.map((flight) => (
        <span
          key={flight.id}
          className="pointer-events-none fixed left-0 top-0 z-[100] animate-quiz-score-icon-flight"
          onAnimationEnd={() => {
            setFlights((current) => current.filter((item) => item.id !== flight.id));
            playSoundEffect("points");
            vibrate("tap");
          }}
          style={{ "--score-flight-start-x": `${flight.startX}px`, "--score-flight-start-y": `${flight.startY}px`, "--score-flight-scatter-x": `${flight.startX}px`, "--score-flight-scatter-y": `${flight.startY - 36}px`, "--score-flight-target-x": `${flight.targetX}px`, "--score-flight-target-y": `${flight.targetY}px` } as CSSProperties}
        >
          <Image src={GEM_ASSETS[selectedType]} alt="" width={32} height={32} className="size-8 object-contain" />
        </span>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}
