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
        <div className="bg-black text-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-6">
          <PageHeader
            title={title}
            description=" "
            mascot="/mascots/mascot5.png"
            mascotSize="2xl"
            centered
            titleClassName="text-white"
            descriptionClassName="invisible"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-center overflow-hidden">
        <QuizStation mode="active" onPhaseChange={setPhase} />
      </div>
    </>
  );
}
