"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { Gem, Sparkles } from "lucide-react";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { useAuthSession } from "@/features/auth/auth-client";
import { convertGemToPointsAction } from "@/features/gems/gem-actions";
import { GEM_ASSETS, GEM_POINTS, type GemType } from "@/features/gems/gem-types";
import { useProgressStats } from "@/features/progress/progress-client";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { cn } from "@/lib/utils";

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

export function MobileGemDetailsSheet({ type, open, onClose }: { type: GemType | null; open: boolean; onClose: () => void }) {
  const { locale } = useLocale();
  const t = useT();
  const { user, updateProfileField, refreshProfile } = useAuthSession();
  const { refreshStats } = useProgressStats();
  const [converting, setConverting] = useState(false);
  const [queuedConversions, setQueuedConversions] = useState(0);
  const [flights, setFlights] = useState<Array<{ id: number; startX: number; startY: number; targetX: number; targetY: number }>>([]);
  const convertButtonRef = useRef<HTMLButtonElement>(null);
  const conversionQueueRef = useRef(0);
  const conversionRunningRef = useRef(false);
  const balanceRef = useRef(0);
  const gemPointsRef = useRef(0);
  const flightIdRef = useRef(0);
  const balanceForType = type === "blue"
    ? user?.profile.blueGems ?? 0
    : type === "green"
      ? user?.profile.greenGems ?? 0
      : type === "purple"
        ? user?.profile.purpleGems ?? 0
        : 0;

  useEffect(() => {
    balanceRef.current = balanceForType;
    gemPointsRef.current = user?.profile.gemPoints ?? 0;
  }, [balanceForType, user?.profile.gemPoints]);

  if (!type) return null;
  const selectedType = type;
  const balance = balanceForType;
  const points = GEM_POINTS[selectedType];
  const availableToQueue = Math.max(0, balance - queuedConversions);

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

        const result = await convertGemToPointsAction(selectedType);
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
    if (!user || availableToQueue < 1) return;
    conversionQueueRef.current += 1;
    setQueuedConversions((current) => current + 1);
    vibrate("tap");
    void drainConversionQueue();
  }

  return (
    <MobileBottomSheetShell
      open={open}
      onClose={onClose}
      title={t(GEM_LABEL_KEYS[selectedType])}
      panelLabel={t("gems.detailsTitle")}
      visual={<Image src={GEM_ASSETS[selectedType]} alt="" width={64} height={64} className="size-16 object-contain" />}
      panelClassName="bg-background-card text-foreground"
      contentClassName="pb-[max(1.25rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex flex-col items-center gap-4 px-5 pb-5 text-center">
        <Image src={GEM_ASSETS[selectedType]} alt="" width={128} height={128} className="-mt-2 size-28 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.28)]" />
        <div>
          <h3 className="text-2xl font-bold text-foreground">{t(GEM_LABEL_KEYS[selectedType])}</h3>
          <p className="mt-1 text-lg font-semibold text-[var(--brand)]">{formatNumber(locale, balance)}</p>
        </div>
        <p className="max-w-sm text-sm leading-5 text-foreground-secondary">{t(GEM_DESCRIPTION_KEYS[selectedType])}</p>
        <button
          type="button"
          ref={convertButtonRef}
          data-gem-convert
          disabled={!user || availableToQueue < 1}
          onClick={handleConvert}
          className={cn("inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 py-3 text-base font-bold text-[var(--brand-foreground)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45", converting && "animate-pulse")}
        >
          <Sparkles className="size-5" aria-hidden="true" />
          <span>{t("gems.convert")}</span>
          <span className="inline-flex items-center gap-1 text-yellow-300">{points}<Gem className="size-4" aria-hidden="true" /></span>
        </button>
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
    </MobileBottomSheetShell>
  );
}
