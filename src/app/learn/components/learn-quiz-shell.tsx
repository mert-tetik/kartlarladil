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

export function LearnQuizShell({ title, description }: LearnQuizShellProps) {
  const [phase, setPhase] = useState<QuizPhase>("language");
  const hideHeader = phase === "celebration";

  return (
    <>
      <div
        data-learn-page-header
        className={cn("max-lg:hidden", hideHeader && "lg:hidden")}
      >
        <PageHeader
          title={title}
          description={description}
          mascot="/mascots/mascot5.png"
          mascotSize="2xl"
        />
      </div>
      <div className="flex flex-1 flex-col justify-center overflow-y-auto">
        <QuizStation mode="active" onPhaseChange={setPhase} />
      </div>
    </>
  );
}
