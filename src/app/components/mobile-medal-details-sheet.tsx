"use client";

import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { useAuthSession } from "@/features/auth/auth-client";
import { useLocale, useT } from "@/i18n/locale-provider";
import { formatNumber } from "@/i18n/labels";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import { RESULT_MEDAL_IMAGE_SRC } from "@/features/progress/components/reward-medal-hud";

const CONTENT_ENTER_DELAY_MS = 520;
const CONTENT_STEP_MS = 70;
const CLOSE_ANIMATION_MS = 860;

export function MobileMedalDetailsSheet({
  open,
  onClose,
  sourceRect = null,
}: {
  open: boolean;
  onClose: () => void;
  sourceRect?: DOMRect | null;
}) {
  const { locale } = useLocale();
  const t = useT();
  const { user } = useAuthSession();
  const [mounted, setMounted] = useState(false);
  const [presented, setPresented] = useState(open);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setPresented(true);
      setClosing(false);
      const frame = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(frame);
    }

    if (!presented) return;
    setClosing(true);
    setEntered(false);
    const timer = window.setTimeout(() => {
      setPresented(false);
      setClosing(false);
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open, presented]);

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

  if (!mounted || !presented || typeof document === "undefined") return null;

  const origin = sourceRect
    ? `${sourceRect.left + sourceRect.width / 2}px ${sourceRect.top + sourceRect.height / 2}px`
    : "50% 50%";
  const useSuperWater = canUseSuperWater(locale);
  const title = formatSuperWaterText(locale, t("medals.detailsTitle"));
  const name = formatSuperWaterText(locale, t("medals.name"));
  const description = formatSuperWaterText(locale, t("medals.description"));
  const medals = user?.profile.quizResultMedals ?? 0;
  const contentItemCount = 3;

  function renderContentItem(index: number, children: ReactNode, className?: string) {
    return (
      <div
        className={cn("star-details-overlay__item", className)}
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

  return createPortal(
    <div
      className={cn(
        "star-details-overlay fixed inset-0 z-[90] flex items-center justify-center bg-transparent px-5 lg:hidden",
        !entered && !closing && "star-details-overlay--preparing",
        closing && "star-details-overlay--closing",
      )}
      style={{ transformOrigin: origin }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-mobile-medal-details
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
        "relative w-full max-w-[22rem] -translate-y-[2.25rem] pt-20",
          closing || !entered ? "translate-y-5 scale-[0.96]" : "translate-y-0 scale-100",
        )}
      >
        <div className="relative flex min-h-[22rem] max-h-[calc(100dvh-2rem)] flex-col items-center justify-center overflow-y-auto rounded-[1.75rem] bg-background-card px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-24 text-center text-foreground shadow-[0_24px_70px_rgb(0_0_0_/_0.45)] ring-1 ring-black/10">
          {renderContentItem(
            0,
            <h2 className={cn("mt-1 w-full text-3xl font-bold leading-none", useSuperWater && "font-super-water")}>
              {name}
            </h2>,
            "w-full",
          )}
          {renderContentItem(
            1,
            <p className={cn("mt-2 w-full text-3xl font-bold leading-none text-amber-400", useSuperWater && "font-super-water")}>
              <span className="inline-flex items-center justify-center gap-1.5">
                {formatNumber(locale, medals)}
                <Image src={RESULT_MEDAL_IMAGE_SRC} alt="" width={22} height={22} className="size-[22px] object-contain" />
              </span>
            </p>,
            "w-full",
          )}
          {renderContentItem(
            2,
            <p className={cn("mx-auto mt-4 w-full max-w-[18rem] text-sm leading-6 text-white", useSuperWater && "font-super-water")}>
              {description}
            </p>,
            "w-full",
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="star-details-overlay__item absolute right-3 top-3 z-10 inline-flex size-10 items-center justify-center text-foreground-muted transition-colors hover:bg-foreground/10 hover:text-foreground"
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
            src={RESULT_MEDAL_IMAGE_SRC}
            alt=""
            width={160}
            height={160}
            className="size-40 object-contain drop-shadow-[0_16px_24px_rgb(0_0_0_/_0.35)]"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
