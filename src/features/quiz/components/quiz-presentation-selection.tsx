"use client";

import { ArrowLeft, BookOpenCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { QuizPresentationMode } from "@/features/quiz/quiz-presentation-mode";

export function QuizPresentationSelection({
  preparing,
  onBack,
  onSelect,
}: {
  preparing: boolean;
  onBack: () => void;
  onSelect: (mode: QuizPresentationMode) => void;
}) {
  const t = useT();

  return (
    <section
      className="animate-screen-pop relative mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-background-card p-5 sm:p-8 lg:p-10 max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:border-y-0 max-lg:p-4"
      data-quiz-presentation-selection
      data-testid="quiz-presentation-selection"
      aria-labelledby="quiz-presentation-title"
      aria-busy={preparing}
    >
      <Button
        type="button"
        variant="ghost"
        className="absolute left-4 top-4 gap-2 sm:left-6 sm:top-6"
        onClick={onBack}
        aria-label={t("common.back")}
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("common.back")}
      </Button>

      <div className="mx-auto w-full max-w-3xl text-center">
        <h2 id="quiz-presentation-title" className="text-2xl font-semibold text-foreground sm:text-3xl">
          {t("quiz.choosePresentationTitle")}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-foreground-secondary sm:text-base">
          {t("quiz.choosePresentationDescription")}
        </p>

        <div className="mt-8 grid w-full gap-4 text-left sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelect("easy")}
            className={cn(
              "group flex min-h-44 flex-col justify-center rounded-2xl border border-emerald-400/50 bg-emerald-600 p-5 text-white shadow-sm shadow-emerald-950/15 transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/50 disabled:cursor-wait disabled:opacity-70 sm:min-h-52 sm:p-6",
            )}
            data-quiz-presentation="easy"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="size-6 shrink-0" aria-hidden="true" />
              <span className="text-xl font-semibold sm:text-2xl">{t("quiz.presentationEasy")}</span>
            </div>
            <span className="mt-3 text-sm leading-6 text-white/90 sm:text-base">
              {t("quiz.presentationEasyDescription")}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelect("classic")}
            className={cn(
              "group flex min-h-44 flex-col justify-center rounded-2xl border border-sky-300/50 bg-sky-700 p-5 text-white shadow-sm shadow-sky-950/20 transition duration-200 hover:-translate-y-0.5 hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-300/50 disabled:cursor-wait disabled:opacity-70 sm:min-h-52 sm:p-6",
            )}
            data-quiz-presentation="classic"
          >
            <div className="flex items-center gap-3">
              <BookOpenCheck className="size-6 shrink-0" aria-hidden="true" />
              <span className="text-xl font-semibold sm:text-2xl">{t("quiz.presentationClassic")}</span>
            </div>
            <span className="mt-3 text-sm leading-6 text-white/90 sm:text-base">
              {t("quiz.presentationClassicDescription")}
            </span>
          </button>
        </div>
        {preparing ? (
          <p className="mt-4 text-sm text-foreground-muted" role="status" aria-live="polite">
            {t("quiz.loadingTitle")}
          </p>
        ) : null}
      </div>
    </section>
  );
}
