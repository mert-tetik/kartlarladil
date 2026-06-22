"use client";

import { LearnModeSelection } from "@/app/learn/components/learn-quiz-shell";

export default function LearnModePreviewPage() {
  return (
    <section
      className="animate-screen-pop mx-auto flex max-w-7xl flex-col justify-center px-4 py-10 max-lg:h-[calc(100dvh-4rem)] max-lg:min-h-[calc(100dvh-4rem)] max-lg:w-full max-lg:max-w-none max-lg:overflow-hidden max-lg:px-0 max-lg:py-0 sm:px-6 lg:px-8"
      data-learn-page
    >
      <LearnModeSelection onSelect={() => {}} />
    </section>
  );
}
