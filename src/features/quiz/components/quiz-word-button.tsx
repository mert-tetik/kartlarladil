"use client";

import {
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";

export type QuizWordButtonType = "select" | "correct" | "incorrect" | "neutral" | "inactive" | "invalid-operation";
export type QuizWordButtonFeedback =
  | "idle"
  | "selected"
  | "matched"
  | "correct"
  | "incorrect"
  | "incorrect-revealed"
  | "muted";

interface QuizWordButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  wordType?: QuizWordButtonType;
  feedback?: QuizWordButtonFeedback;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  pressAnimation?: boolean;
  animationTrigger?: number;
  correctClassName?: string;
  style?: CSSProperties;
}

const FEEDBACK_CLASSES: Record<QuizWordButtonFeedback, string> = {
  idle: "border-[#aaaaaa] bg-background text-foreground",
  selected: "border-brand bg-background text-brand ring-2 ring-brand/35",
  matched: "border-transparent text-white shadow-sm",
  correct: "border-emerald-500 bg-[#303030] text-emerald-600 animate-quiz-word-button-correct",
  incorrect: "border-rose-500 bg-background text-rose-600 animate-bonus-incorrect-shake",
  "incorrect-revealed": "border-rose-500 bg-background text-rose-600",
  muted: "border-[#aaaaaa] bg-background text-foreground opacity-60",
};

export function QuizWordButton({
  children,
  wordType = "neutral",
  feedback,
  selected,
  onSelectedChange,
  pressAnimation = true,
  className,
  disabled,
  onClick,
  style,
  animationTrigger = 0,
  correctClassName,
  ...props
}: QuizWordButtonProps) {
  const [internalSelected, setInternalSelected] = useState(false);
  const [pressedFeedback, setPressedFeedback] = useState<QuizWordButtonFeedback | null>(null);
  const [invalidOperationKey, setInvalidOperationKey] = useState(0);
  const [inactiveAfterPress, setInactiveAfterPress] = useState(false);
  const isInactive = wordType === "inactive" && inactiveAfterPress;
  const isInteractive = !isInactive && wordType !== "neutral" && !disabled;
  const isSelected = selected ?? internalSelected;
  const visualState: QuizWordButtonFeedback = feedback
    ?? (wordType === "select"
      ? isSelected ? "selected" : "idle"
      : wordType === "inactive"
        ? isInactive ? "muted" : "idle"
        : pressedFeedback ?? "idle");

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (wordType === "select" || wordType === "neutral") {
      vibrate("tap");
    } else if (wordType === "correct") {
      vibrate("correct");
    } else if (wordType === "incorrect" || wordType === "invalid-operation") {
      vibrate("incorrect");
    } else if (wordType === "inactive") {
      vibrate("tap");
    }

    if (wordType === "select") {
      const nextSelected = !isSelected;
      if (selected === undefined) {
        setInternalSelected(nextSelected);
      }
      onSelectedChange?.(nextSelected);
    } else if (wordType === "correct" || wordType === "incorrect") {
      setPressedFeedback(wordType);
    } else if (wordType === "invalid-operation") {
      setInvalidOperationKey((current) => current + 1);
    } else if (wordType === "inactive") {
      setInactiveAfterPress(true);
    }

    onClick?.(event);
  }

  return (
    <button
      // Recreate the DOM node when feedback changes so CSS feedback animations
      // always start from their first frame after an answer is revealed.
      key={`${wordType}-${visualState}-${wordType === "invalid-operation" ? `${invalidOperationKey}-${animationTrigger}` : ""}`}
      {...props}
      type={props.type ?? "button"}
      disabled={disabled || isInactive}
      onClick={handleClick}
      style={style}
      className={cn(
        "quiz-word-button relative inline-flex items-center justify-center overflow-visible rounded-2xl border-[3px] border-b-[9px] px-3 py-2 text-sm font-semibold transition-[background-color,border-color,color,opacity,box-shadow] duration-300 ease-[cubic-bezier(0.85,0,0.15,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none",
        FEEDBACK_CLASSES[visualState],
        visualState === "correct" && correctClassName,
        visualState === "correct" && "z-20 duration-0",
        visualState === "selected" && "animate-quiz-word-button-select",
        wordType === "invalid-operation" && (invalidOperationKey > 0 || animationTrigger > 0) && "animate-quiz-word-button-invalid-operation",
        wordType === "select" && "duration-150",
        wordType === "inactive" && inactiveAfterPress && "animate-quiz-word-button-inactive duration-[400ms]",
        wordType === "neutral" && pressAnimation && "quiz-word-button-neutral",
        isInteractive && "cursor-pointer",
        !isInteractive && "cursor-default",
        className,
      )}
      data-quiz-word-type={wordType}
      data-quiz-word-state={visualState}
      data-quiz-answer-feedback={visualState === "muted" ? "idle" : visualState}
    >
      {visualState === "correct" ? (
        <span
          aria-hidden="true"
          className="quiz-word-button-correct-shine pointer-events-none absolute"
        />
      ) : null}
      <span className="relative z-10 w-full">{children}</span>
    </button>
  );
}
