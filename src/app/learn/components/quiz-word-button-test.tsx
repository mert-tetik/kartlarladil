"use client";

import { useState } from "react";
import {
  QuizWordButton,
  type QuizWordButtonType,
} from "@/features/quiz/components/quiz-word-button";

const BUTTON_TYPES: Array<{ value: QuizWordButtonType; label: string }> = [
  { value: "select", label: "Seçme" },
  { value: "correct", label: "Doğru" },
  { value: "incorrect", label: "Yanlış" },
  { value: "neutral", label: "Nötr" },
  { value: "inactive", label: "Pasif" },
  { value: "invalid-operation", label: "Geçersiz işlem" },
];

export function QuizWordButtonTest() {
  const [wordType, setWordType] = useState<QuizWordButtonType>("select");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#08090b] px-5"
      data-quiz-word-button-test
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-5">
        <QuizWordButton
          key={wordType}
          type="button"
          wordType={wordType}
          className="min-h-16 w-full text-lg"
        >
          kelime
        </QuizWordButton>
        <select
          aria-label="Buton durumu"
          value={wordType}
          onChange={(event) => setWordType(event.target.value as QuizWordButtonType)}
          className="h-11 w-full rounded-lg border border-white/20 bg-[#15171b] px-3 text-sm font-semibold text-white outline-none focus:border-white/60"
        >
          {BUTTON_TYPES.map((buttonType) => (
            <option key={buttonType.value} value={buttonType.value}>
              {buttonType.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
