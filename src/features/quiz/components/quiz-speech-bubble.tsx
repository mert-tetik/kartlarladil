"use client";

import Image from "next/image";
import { Volume2 } from "lucide-react";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useT } from "@/i18n/locale-provider";
import {
  getAiPracticeCharacters,
  getCharacterName,
  getCharacterVoiceProfile,
} from "@/features/ai-practice/ai-practice-data";
import { speakCardTerm } from "@/features/cards/card-speech";
import type { AiPracticeCharacter, LanguageCode } from "@/types/domain";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";

export function getRandomQuizCharacter() {
  const characters = getAiPracticeCharacters();
  return characters[Math.floor(Math.random() * characters.length)]!;
}

export function QuizSpeechBubble({
  character,
  term,
  spokenTerm,
  language,
  secondaryText,
  showSpeaker = true,
  speakerPosition = "right",
  speakerLayout = "row",
  arrowPosition = "left",
  speakerClassName,
  speakerIconClassName,
  termClassName,
  largeCharacter = false,
  showCharacter = true,
  characterVideoSrc,
  characterClassName,
  bubbleClassName,
  disableEntryOffset = false,
  className,
}: {
  character: AiPracticeCharacter;
  term: string;
  spokenTerm?: string;
  language: LanguageCode;
  secondaryText?: string;
  showSpeaker?: boolean;
  speakerPosition?: "left" | "right";
  speakerLayout?: "row" | "stacked";
  arrowPosition?: "left" | "bottom";
  speakerClassName?: string;
  speakerIconClassName?: string;
  termClassName?: string;
  largeCharacter?: boolean;
  showCharacter?: boolean;
  characterVideoSrc?: string;
  characterClassName?: string;
  bubbleClassName?: string;
  disableEntryOffset?: boolean;
  className?: string;
}) {
  const t = useT();
  const characterName = getCharacterName(character, language);
  const voiceProfile = getCharacterVoiceProfile(character);
  const hasCharacterVideo = Boolean(characterVideoSrc && showCharacter);
  const [characterVideoReady, setCharacterVideoReady] = useState(!hasCharacterVideo);
  const arrowClassName = arrowPosition === "bottom"
    ? "before:left-1/2 before:top-auto before:bottom-[-0.55rem] before:-translate-x-1/2 before:rotate-45 before:border-b-[3px] before:border-r-[3px] before:border-l-0 before:border-t-0"
    : "before:left-[-0.55rem] before:top-1/2 before:-translate-y-1/2 before:rotate-45 before:border-b-[3px] before:border-l-[3px]";

  return (
    <div className={cn(
      "relative mx-auto flex w-full max-w-xl items-center gap-2 border-b border-[#AAAAAA] px-1 transition-opacity duration-150 sm:gap-3",
      !disableEntryOffset && "-translate-y-5 sm:-translate-y-6",
      hasCharacterVideo && (characterVideoReady ? "opacity-100" : "pointer-events-none opacity-0"),
      className,
    )}>
      {showCharacter ? (
        <div
          className={cn(
            "relative shrink-0",
            largeCharacter ? "h-36 w-36 sm:h-40 sm:w-40" : "h-28 w-28 sm:h-32 sm:w-32",
            characterClassName,
          )}
        >
          {characterVideoSrc ? (
            <QuizSpeechCharacterVideo
              key={characterVideoSrc}
              src={characterVideoSrc}
              label={characterName}
              onReady={() => setCharacterVideoReady(true)}
              onError={() => setCharacterVideoReady(false)}
            />
          ) : (
            <Image
              src={character.imageSrc}
              alt={characterName}
              fill
              sizes={largeCharacter ? "(max-width: 639px) 144px, 160px" : "(max-width: 639px) 112px, 128px"}
              quality={90}
              className="object-contain object-bottom"
            />
          )}
        </div>
      ) : null}
      <div className={cn(
        "relative min-w-0 flex-1 rounded-2xl border-[3px] border-[#AAAAAA] bg-background px-4 py-3 text-left shadow-sm sm:px-5 sm:py-4 before:absolute before:size-4 before:border-[#AAAAAA] before:bg-background",
        arrowClassName,
        bubbleClassName,
      )}>
        <div className={cn(
          "relative flex",
          speakerLayout === "stacked"
            ? "flex-col items-center justify-center gap-1"
            : "items-center justify-between gap-3",
          speakerLayout === "row" && speakerPosition === "left" && "justify-start",
        )}>
          <h2 className={cn(
            "min-w-0 break-words font-display text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl",
            speakerLayout === "stacked" && "text-center",
            speakerLayout === "stacked"
              ? "order-2"
              : speakerPosition === "left" && "order-2",
            termClassName,
          )}>
            {term}
          </h2>
          {showSpeaker ? (
            <button
              type="button"
              onClick={() => speakCardTerm(spokenTerm ?? term, language, voiceProfile.gender, voiceProfile.age)}
              onPointerDown={() => vibrate("tap")}
              className={cn(
                "inline-flex size-10 shrink-0 items-center justify-center rounded-md text-white transition-transform duration-500 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground active:scale-90 max-sm:size-8",
                speakerLayout === "stacked"
                  ? "order-1"
                  : speakerPosition === "left" && "order-1",
                speakerClassName,
              )}
              aria-label={`${term} ${t("cards.speak")}`}
              title={t("cards.speak")}
            >
              <Volume2
                className={cn("size-5 max-sm:size-4", speakerIconClassName)}
                aria-hidden="true"
              />
            </button>
          ) : null}
        </div>
        {secondaryText ? (
          <p className="relative mt-1 break-words text-lg font-semibold leading-snug text-white/80 sm:text-xl">
            {secondaryText}
          </p>
        ) : null}
      </div>
    </div>
  );
}

const CHARACTER_VIDEO_REPLAY_DELAY_MS = 4000;

function QuizSpeechCharacterVideo({
  src,
  label,
  onReady,
  onError,
}: {
  src: string;
  label: string;
  onReady: () => void;
  onError: () => void;
}) {
  const replayTimerRef = useRef<number | null>(null);
  const [videoState, setVideoState] = useState<"pending" | "ready" | "unavailable">("pending");

  useEffect(() => {
    return () => {
      if (replayTimerRef.current !== null) {
        window.clearTimeout(replayTimerRef.current);
      }
    };
  }, []);

  function handleVideoReady() {
    setVideoState("ready");
    onReady();
  }

  function handleVideoError() {
    if (replayTimerRef.current !== null) {
      window.clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }

    setVideoState("unavailable");
    onError();
  }

  function handleEnded(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    replayTimerRef.current = window.setTimeout(() => {
      replayTimerRef.current = null;
      video.currentTime = 0;
      void video.play().catch(() => undefined);
    }, CHARACTER_VIDEO_REPLAY_DELAY_MS);
  }

  if (videoState === "unavailable") return null;

  return (
    <video
      src={src}
      aria-label={label}
      autoPlay
      muted
      playsInline
      preload="auto"
      onCanPlay={handleVideoReady}
      onLoadedData={handleVideoReady}
      onError={handleVideoError}
      onEnded={handleEnded}
      className={cn(
        "absolute inset-0 size-full object-contain object-bottom transition-opacity duration-150",
        videoState === "ready" ? "visible opacity-100" : "invisible opacity-0",
      )}
      data-quiz-speech-character-video
    />
  );
}
