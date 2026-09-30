"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { CARD_GROUP_IMAGE_PATHS } from "@/features/cards/card-groups";
import { createLandingGroupQuestion } from "@/features/cards/landing-group-question";
import type { LanguageCode } from "@/types/domain";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";

export function LandingGroupQuestion({ language }: { language: LanguageCode }) {
  const { locale } = useLocale();
  const t = useT();
  const [question, setQuestion] = useState<ReturnType<typeof createLandingGroupQuestion>>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuestion(createLandingGroupQuestion(language, locale));
      setSelectedOptionId(null);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [language, locale]);

  if (!question) return null;

  return (
    <section
      className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-background-card p-4 text-center shadow-sm sm:p-6"
      data-landing-group-question
    >
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t("home.landingGroupQuestion.title")}</p>
      <p className="mt-2 text-2xl font-bold text-foreground sm:text-3xl" data-landing-group-question-prompt>
        {question.prompt}
      </p>
      <p className="mt-1 text-sm text-foreground-secondary">{t("home.landingGroupQuestion.description")}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4" role="group" aria-label={t("home.landingGroupQuestion.optionsLabel")}>
        {question.options.map((option) => {
          const selected = selectedOptionId !== null;
          const isChosen = selectedOptionId === option.card.id;
          const isCorrect = option.isCorrect;

          return (
            <button
              key={option.card.id}
              type="button"
              className={cn(
                "relative flex aspect-square min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-border bg-background px-2 py-3 text-foreground transition-[border-color,background-color,transform] duration-200 active:scale-[0.98]",
                !selected && "border-brand/50",
                selected && isCorrect && "border-emerald-400 bg-emerald-400/10",
                selected && isChosen && !isCorrect && "border-red-400 bg-red-400/10",
              )}
              onClick={() => {
                if (selectedOptionId !== null) return;
                setSelectedOptionId(option.card.id);
                vibrate(option.isCorrect ? "correct" : "incorrect");
              }}
              aria-pressed={isChosen}
            >
              <span className="line-clamp-2 text-base font-bold leading-tight sm:text-lg">{option.card.term}</span>
              <Image
                src={CARD_GROUP_IMAGE_PATHS[option.group.id]}
                alt=""
                width={92}
                height={92}
                className="size-20 object-contain sm:size-24"
                aria-hidden="true"
              />
              {selected && isCorrect ? <Check className="absolute right-2 top-2 size-5 text-emerald-400" aria-hidden="true" /> : null}
              {selected && isChosen && !isCorrect ? <X className="absolute right-2 top-2 size-5 text-red-400" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
