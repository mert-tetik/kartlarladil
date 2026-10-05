"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/i18n/locale-provider";
import { formatSuperWaterText } from "@/lib/super-water";
import { playSoundEffect } from "@/lib/sound-effects";
import { cn } from "@/lib/utils";

interface QuizCompletionProgressViewProps {
  enterWithCss?: boolean;
  onComplete: () => void;
}

const QUIZ_COMPLETION_FILL_DURATION_MS = 1_400;
const QUIZ_COMPLETION_PARTICLE_START_OFFSET_MS = 120;
const QUIZ_COMPLETION_PARTICLE_DURATION_MS = 480;
const QUIZ_COMPLETION_LABEL_ENTER_DURATION_MS = 520;
const QUIZ_COMPLETION_LABEL_HOLD_MS = 1_000;
const QUIZ_COMPLETION_EXIT_DURATION_MS = 420;
const QUIZ_COMPLETION_PARTICLE_COUNT = 22;

type CompletionParticle = {
  startX: number;
  startY: number;
  y: number;
  x: number;
  rotation: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
};

function createCompletionParticles(): CompletionParticle[] {
  return Array.from({ length: QUIZ_COMPLETION_PARTICLE_COUNT }, () => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 52 + Math.random() * 92;

    return {
      startX: 5 + Math.round(Math.random() * 90),
      startY: 16 + Math.round(Math.random() * 68),
      x: Math.round(Math.cos(angle) * distance),
      y: Math.round(Math.sin(angle) * distance),
      rotation: Math.round((Math.random() - 0.5) * 300),
      size: 7 + Math.round(Math.random() * 7),
      duration: 300 + Math.round(Math.random() * 100),
      delay: Math.round(Math.random() * 45),
      color: "#facc15",
    };
  });
}

export function QuizCompletionProgressView({
  enterWithCss = false,
  onComplete,
}: QuizCompletionProgressViewProps) {
  const { locale, t } = useLocale();
  const onCompleteRef = useRef(onComplete);
  const completedRef = useRef(false);
  const [progress, setProgress] = useState(0);
  const [particlesVisible, setParticlesVisible] = useState(false);
  const [progressComplete, setProgressComplete] = useState(false);
  const [labelVisible, setLabelVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [particles] = useState(createCompletionParticles);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const complete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setProgress(100));
    const particleTimer = window.setTimeout(
      () => setParticlesVisible(true),
      Math.max(
        0,
        QUIZ_COMPLETION_FILL_DURATION_MS -
        QUIZ_COMPLETION_PARTICLE_START_OFFSET_MS,
      ),
    );
    const completionTimer = window.setTimeout(() => {
      setProgressComplete(true);
      playSoundEffect("quiz-completion-progress-pop");
    }, QUIZ_COMPLETION_FILL_DURATION_MS);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(particleTimer);
      window.clearTimeout(completionTimer);
    };
  }, []);

  useEffect(() => {
    if (!particlesVisible) return;

    const labelTimer = window.setTimeout(
      () => setLabelVisible(true),
      QUIZ_COMPLETION_PARTICLE_DURATION_MS,
    );

    return () => window.clearTimeout(labelTimer);
  }, [particlesVisible]);

  useEffect(() => {
    if (!labelVisible) return;

    const closeTimer = window.setTimeout(
      () => setClosing(true),
      QUIZ_COMPLETION_LABEL_ENTER_DURATION_MS + QUIZ_COMPLETION_LABEL_HOLD_MS,
    );

    return () => window.clearTimeout(closeTimer);
  }, [labelVisible]);

  useEffect(() => {
    if (!closing) return;

    const completeTimer = window.setTimeout(
      complete,
      QUIZ_COMPLETION_EXIT_DURATION_MS,
    );

    return () => window.clearTimeout(completeTimer);
  }, [closing, complete]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-background",
        enterWithCss && "quiz-flow-enter-right",
      )}
      data-learn-quiz-page="quiz"
      data-quiz-completion-progress
    >
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center px-8 transition-[scale,opacity] duration-[420ms] ease-[cubic-bezier(0.85,0,0.15,1)] will-change-[scale,opacity]",
          closing ? "scale-0 opacity-0" : "scale-100 opacity-100",
        )}
      >
        <div className="relative w-full max-w-[22rem]">
          <Progress
            value={progress}
            className={cn(
              "h-[18px] rounded-full bg-[#262626]",
              progressComplete && "animate-quiz-completion-progress-pulse",
            )}
            indicatorClassName={cn(
              "bg-amber-400 transition-[width] duration-[1400ms] ease-[cubic-bezier(0.78,0,1,1)]",
              progressComplete && "animate-quiz-completion-progress-glow",
            )}
            indicatorOverlayClassName="left-[5px] right-[5px] top-[calc(50%_-_3px)] bottom-auto h-[5px] -translate-y-1/2 rounded-full bg-white/50"
          />

          <span
            className="pointer-events-none absolute inset-0 z-10 block"
            aria-hidden="true"
          >
            {particlesVisible
              ? particles.map((particle, index) => (
                  <span
                    key={index}
                    className="quiz-completion-particle absolute left-0 top-0 block rounded-[2px]"
                    style={
                      {
                        left: `${particle.startX}%`,
                        top: `${particle.startY}%`,
                        width: particle.size,
                        height: particle.size,
                        backgroundColor: particle.color,
                        animationDuration: `${particle.duration}ms`,
                        animationDelay: `${particle.delay}ms`,
                        "--completion-particle-x": `${particle.x}px`,
                        "--completion-particle-y": `${particle.y}px`,
                        "--completion-particle-rotation": `${particle.rotation}deg`,
                      } as CSSProperties
                    }
                  />
                ))
              : null}
          </span>

        </div>
        {labelVisible ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[calc(50%+29px)] z-20 w-full">
          <p
            className="m-0 whitespace-nowrap text-center text-4xl font-bold leading-none text-yellow-400 animate-quiz-completion-label-enter sm:text-6xl"
            data-quiz-completion-label
          >
            <span className="font-super-water">
              {formatSuperWaterText(locale, t("quiz.finished"))}
            </span>
          </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
