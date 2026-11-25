"use client";

import { useState } from "react";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

const REVIEW_INTRO_STEP_KEYS = [
  "home.learnedReviewIntro.stepOne",
  "home.learnedReviewIntro.stepTwo",
  "home.learnedReviewIntro.stepThree",
] as const;

export function LearnedReviewIntroDialog({
  open,
  onClose,
  onExited,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onExited?: () => void;
  onStart: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState(0);

  const isLastStep = step === REVIEW_INTRO_STEP_KEYS.length - 1;

  return (
    <MobileBottomSheetShell
      open={open}
      onClose={onClose}
      onExited={onExited}
      presentation="centered-dialog"
      title={t("home.learnedReviewIntro.title")}
      panelLabel={t("home.learnedReviewIntro.title")}
      panelClassName="bg-[#168bd2] text-white"
      tone="brand"
      visual={null}
      showProtrusionCircle={false}
      showPanelDecoration={false}
      centeredDialogOffsetY={0}
      contentClassName="px-6 pb-6"
      titleClassName="text-white"
    >
      <div className="flex flex-1 flex-col text-center text-white" data-learned-review-intro-step={step + 1}>
        <p className="text-xs font-semibold text-white/75">
          {t("home.learnedReviewIntro.stepCount", { current: step + 1, total: REVIEW_INTRO_STEP_KEYS.length })}
        </p>
        <div className="mt-3 flex justify-center gap-2" aria-hidden="true">
          {REVIEW_INTRO_STEP_KEYS.map((key, index) => (
            <span
              key={key}
              className={cn(
                "h-1.5 rounded-full transition-all",
                index === step ? "w-7 bg-white" : "w-1.5 bg-white/40",
              )}
            />
          ))}
        </div>

        <p className="mt-5 min-h-20 text-base font-semibold leading-7">
          {t(REVIEW_INTRO_STEP_KEYS[step])}
        </p>

        <div className="mt-6 flex items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              data-testid="learned-review-intro-back"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              className="min-h-12 flex-1 rounded-lg border border-white/45 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
            >
              {t("home.learnedReviewIntro.back")}
            </button>
          ) : null}
          <button
            type="button"
            data-testid={isLastStep ? "learned-review-intro-start" : "learned-review-intro-continue"}
            onClick={() => {
              if (isLastStep) {
                onStart();
                return;
              }
              setStep((current) => Math.min(REVIEW_INTRO_STEP_KEYS.length - 1, current + 1));
            }}
            className="min-h-12 flex-1 rounded-lg bg-white px-5 text-sm font-bold text-[#12639a] transition-transform active:scale-[0.98]"
          >
            {t(isLastStep ? "home.learnedReviewIntro.start" : "home.learnedReviewIntro.continue")}
          </button>
        </div>
      </div>
    </MobileBottomSheetShell>
  );
}
