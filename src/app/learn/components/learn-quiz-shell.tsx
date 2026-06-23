"use client";

import { GraduationCap, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { NoCardsEmptyState } from "@/features/inventory/components/no-cards-empty-state";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import type { QuizPhase } from "@/features/quiz/components/quiz-station";
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
  initialMode,
}: LearnQuizShellProps) {
  const [selectedMode, setSelectedMode] = useState<PracticeMode | null>(initialMode);
  const [phase, setPhase] = useState<LearnShellPhase>(initialMode ? "language" : "mode");
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const t = useT();
  const showHeader = phase === "mode" || phase === "language" || phase === "count";

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setSelectedMode(initialMode);
      setPhase(initialMode ? "language" : "mode");
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialMode]);

  if (!hydrated) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <EmptyState
          title={t("quiz.loadingTitle")}
          description={t("quiz.loadingDescription")}
        />
      </div>
    );
  }

  if (cards.length === 0) {
    return <NoCardsEmptyState variant="learn" />;
  }

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

export function LearnModeSelection({ onSelect }: { onSelect: (mode: PracticeMode) => void }) {
  const t = useT();

  return (
    <div className="animate-screen-pop mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-background-card p-5 sm:p-8 lg:p-10 max-lg:max-w-none max-lg:rounded-none max-lg:border-x-0 max-lg:border-y-0 max-lg:p-4">
      <div className="flex w-full max-w-3xl flex-col items-center justify-center">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">
          {t("quiz.chooseModeTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-foreground-secondary sm:text-base">
            {t("quiz.chooseModeDescription")}
          </p>
        </div>

        <div className="mt-8 grid w-full gap-3 sm:gap-4 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => onSelect("active")}
            className="flex min-h-[136px] flex-col justify-center rounded-2xl border border-emerald-500 bg-emerald-500 p-5 text-left text-white transition-colors hover:bg-emerald-600 sm:min-h-[148px] sm:p-6"
          >
            <div className="flex items-center gap-3">
              <GraduationCap className="size-6 shrink-0 text-white" aria-hidden="true" />
              <h3 className="text-xl font-semibold text-white">{t("inventory.learn")}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/90">
              {t("page.learn.description")}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelect("learned")}
            className="flex min-h-[136px] flex-col justify-center rounded-2xl border border-sky-500 bg-sky-500 p-5 text-left text-white transition-colors hover:bg-sky-600 sm:min-h-[148px] sm:p-6"
          >
            <div className="flex items-center gap-3">
              <RotateCcw className="size-6 shrink-0 text-white" aria-hidden="true" />
              <h3 className="text-xl font-semibold text-white">{t("inventory.repeatPractice")}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/90">
              {t("page.learned.practiceDescription")}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
