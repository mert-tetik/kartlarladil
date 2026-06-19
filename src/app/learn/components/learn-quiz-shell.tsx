"use client";

import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { QuizStation } from "@/features/quiz/components/quiz-station";
import type { QuizPhase } from "@/features/quiz/components/quiz-station";
import { cn } from "@/lib/utils";

interface LearnQuizShellProps {
  title: string;
  description: string;
}

export function LearnQuizShell({ title, description: _description }: LearnQuizShellProps) {
  const [phase, setPhase] = useState<QuizPhase>("language");
  const showHeader = phase === "language" || phase === "count";

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
            mascotSize="md"
            centered
            titleClassName="text-white text-6xl md:text-7xl lg:text-8xl"
            descriptionClassName="invisible"
          />
        </div>
      </div>
      <div className="mt-8 flex flex-1 flex-col justify-center overflow-hidden">
        <QuizStation mode="active" onPhaseChange={setPhase} />
      </div>
    </>
  );
}
