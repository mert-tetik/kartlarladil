"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { getRandomWordRepetitionCharacterImage } from "@/features/quiz/quiz-word-repetition-character";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

const CHARACTER_ENTER_DURATION_MS = 560;
const BUBBLE_ENTER_DURATION_MS = 360;
const TYPING_INTERVAL_MS = 42;
const AUTO_SKIP_DELAY_MS = 2000;
const DOUBLE_TAP_WINDOW_MS = 300;
export function QuizWordRepetitionIntroView({
  enterWithCss,
  onComplete,
}: {
  enterWithCss: boolean;
  onComplete: () => void;
}) {
  const t = useT();
  const [characterImage] = useState(() => getRandomWordRepetitionCharacterImage());
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [typingStarted, setTypingStarted] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [typingComplete, setTypingComplete] = useState(false);
  const characterTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const autoSkipTimerRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const readyForSingleTapRef = useRef(false);
  const lastPointerUpRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const introText = t("quiz.wordRepetitionIntro");

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    readyForSingleTapRef.current = false;

    if (characterTimerRef.current !== null) window.clearTimeout(characterTimerRef.current);
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    if (typingTimerRef.current !== null) window.clearInterval(typingTimerRef.current);
    if (autoSkipTimerRef.current !== null) window.clearTimeout(autoSkipTimerRef.current);

    onCompleteRef.current();
  }, []);

  useEffect(() => {
    characterTimerRef.current = window.setTimeout(() => {
      setBubbleVisible(true);
      bubbleTimerRef.current = window.setTimeout(() => {
        setTypingStarted(true);
      }, BUBBLE_ENTER_DURATION_MS);
    }, CHARACTER_ENTER_DURATION_MS);

    return () => {
      if (characterTimerRef.current !== null) window.clearTimeout(characterTimerRef.current);
      if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!typingStarted) return;

    const characters = Array.from(introText);
    let index = 0;
    typingTimerRef.current = window.setInterval(() => {
      index += 1;
      setTypedText(characters.slice(0, index).join(""));
      if (index >= characters.length) {
        if (typingTimerRef.current !== null) {
          window.clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        setTypingComplete(true);
      }
    }, TYPING_INTERVAL_MS);

    return () => {
      if (typingTimerRef.current !== null) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, [introText, typingStarted]);

  useEffect(() => {
    if (!typingComplete) return;

    readyForSingleTapRef.current = true;
    autoSkipTimerRef.current = window.setTimeout(complete, AUTO_SKIP_DELAY_MS);

    return () => {
      if (autoSkipTimerRef.current !== null) {
        window.clearTimeout(autoSkipTimerRef.current);
        autoSkipTimerRef.current = null;
      }
    };
  }, [complete, typingComplete]);

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const now = performance.now();
    if (readyForSingleTapRef.current || now - lastPointerUpRef.current <= DOUBLE_TAP_WINDOW_MS) {
      complete();
      return;
    }

    lastPointerUpRef.current = now;
    if (event.pointerType === "mouse") {
      lastPointerUpRef.current = 0;
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 text-center",
        enterWithCss && "quiz-flow-enter-right",
      )}
      role="button"
      tabIndex={0}
      aria-label={introText}
      data-learn-quiz-page="quiz"
      data-quiz-word-repetition-intro
      onPointerUp={handlePointerUp}
      onDoubleClick={complete}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && typingComplete) {
          event.preventDefault();
          complete();
        }
      }}
    >
      <div className="flex w-full max-w-2xl items-center gap-2 sm:gap-3">
        <div className="relative h-40 w-36 shrink-0 sm:h-52 sm:w-48">
          <Image
            src={characterImage}
            alt=""
            fill
            sizes="(max-width: 639px) 144px, 192px"
            quality={90}
            className="quiz-word-repetition-intro-character object-contain object-bottom"
          />
        </div>

        {bubbleVisible ? (
          <div className="quiz-word-repetition-intro-bubble relative -translate-y-[7px] min-h-[68px] min-w-0 flex-1 rounded-2xl border-[3px] border-[#AAAAAA] bg-background px-4 py-4 text-left shadow-sm sm:min-h-[82px] sm:px-5 sm:py-5 lg:min-h-[88px]">
            <span
              className="absolute left-[-0.55rem] top-1/2 size-4 -translate-y-1/2 rotate-45 border-b-[3px] border-l-[3px] border-[#AAAAAA] bg-background"
              aria-hidden="true"
            />
            <p className="relative break-words font-display text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl">
              {typedText}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
