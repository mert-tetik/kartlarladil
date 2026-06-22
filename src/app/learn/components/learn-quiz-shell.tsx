"use client";

import { GraduationCap, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import type { QuizPhase } from "@/features/quiz/components/quiz-station";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/locale-provider";
import type { PracticeMode } from "@/types/domain";

type LearnShellPhase = QuizPhase | "mode";

interface LearnQuizShellProps {
  title: string;
  description: string;
  initialMode: PracticeMode | null;
}

export function LearnQuizShell({
  title,
  description: _description,
  initialMode,
}: LearnQuizShellProps) {
  const [selectedMode, setSelectedMode] = useState<PracticeMode | null>(initialMode);
  const [phase, setPhase] = useState<LearnShellPhase>(initialMode ? "language" : "mode");
  const showHeader = phase === "mode" || phase === "language" || phase === "count";

  useEffect(() => {
    setSelectedMode(initialMode);
    setPhase(initialMode ? "language" : "mode");
  }, [initialMode]);

  return (
    <>
      <div
        data-learn-page-header
        className={cn(
          "max-lg:hidden",
          !showHeader && "lg:hidden",
        )}
      >
        <div className="relative left-1/2 w-screen -translate-x-1/2 bg-black px-4 py-4 text-white sm:px-6 lg:px-8">
          <PageHeader
            title={title}
            description=" "
            mascot="/mascots/mascot5.png"
            mascotSize="lg"
            centered
            titleClassName="text-white text-5xl md:text-6xl lg:text-7xl"
            descriptionClassName="invisible"
          />
        </div>
      </div>
      <div className="mt-8 flex min-h-0 flex-1 flex-col items-center justify-center max-lg:mt-0 max-lg:w-full">
        {selectedMode ? (
          <QuizStation
            key={selectedMode}
            mode={selectedMode}
            onPhaseChange={setPhase}
            onBackToMode={() => {
              setSelectedMode(null);
              setPhase("mode");
            }}
          />
        ) : (
          <LearnModeSelection
            onSelect={(mode) => {
              setSelectedMode(mode);
              setPhase("language");
            }}
          />
        )}
      </div>
    </>
  );
}

function LearnModeSelection({ onSelect }: { onSelect: (mode: PracticeMode) => void }) {
  const t = useT();

  return (
    <div className="animate-screen-pop mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-background-card p-5 sm:p-8 lg:p-10 max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:border-y-0 max-lg:p-4">
      <div className="mx-auto max-w-2xl text-center">
        <Badge className="border-transparent bg-brand/10 text-brand">{t("page.learn.title")}</Badge>
        <h2 className="mt-4 text-2xl font-semibold text-foreground sm:text-3xl">
          {t("quiz.chooseModeTitle")}
        </h2>
        <p className="mt-3 text-sm leading-6 text-foreground-secondary sm:text-base">
          {t("quiz.chooseModeDescription")}
        </p>
      </div>

      <div className="mt-6 grid gap-3 max-lg:min-h-0 max-lg:flex-1 max-lg:[grid-template-rows:repeat(2,minmax(0,1fr))] lg:mt-8 lg:grid-cols-2 lg:gap-4">
        <button
          type="button"
          onClick={() => onSelect("active")}
          className="flex h-full min-h-0 flex-col rounded-2xl border border-emerald-600 bg-emerald-600 p-5 text-left text-white transition-colors hover:bg-emerald-700 sm:p-6"
        >
          <div className="inline-flex size-12 items-center justify-center text-white">
            <GraduationCap className="size-6" aria-hidden="true" />
          </div>
          <h3 className="mt-5 text-xl font-semibold text-white">{t("inventory.learn")}</h3>
          <p className="mt-3 text-sm leading-6 text-white/90">
            {t("page.learn.description")}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelect("learned")}
          className="flex h-full min-h-0 flex-col rounded-2xl border border-sky-600 bg-sky-600 p-5 text-left text-white transition-colors hover:bg-sky-700 sm:p-6"
        >
          <div className="inline-flex size-12 items-center justify-center text-white">
            <RotateCcw className="size-6" aria-hidden="true" />
          </div>
          <h3 className="mt-5 text-xl font-semibold text-white">{t("inventory.repeatPractice")}</h3>
          <p className="mt-3 text-sm leading-6 text-white/90">
            {t("page.learned.practiceDescription")}
          </p>
        </button>
      </div>
    </div>
  );
}
