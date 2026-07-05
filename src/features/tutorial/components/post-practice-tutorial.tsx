"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TUTORIAL_SCREENS = [
  {
    image: "/tutorial-post-practice/first-screen.png",
    text: "Kartları destene ekle!",
  },
  {
    image: "/tutorial-post-practice/second-screen.png",
    text: "Her bir kartın öğrenilme eşiği vardır!",
  },
  {
    image: "/tutorial-post-practice/third-screen.png",
    text: 'Bir kartı öğrenmek için "Öğrenmeye Başla" butonu ile quizleri tamamla.',
  },
  {
    image: "/tutorial-post-practice/fourth-screen.png",
    text: "Kartın öğrenme eşiği kadar quiz çözdükten sonra kart otomatik olarak öğrenilir!",
  },
  {
    image: "/tutorial-post-practice/fifth-screen.png",
    text: "Öğrenilen kartlar \"Öğrenildi\" destende ayrı olarak gözükür.",
  },
  {
    image: "/tutorial-post-practice/sixth-screen.png",
    text: "Kart öğrendikçe puan kazan ve rütbe atla!",
  },
  {
    image: "/tutorial-post-practice/seventh-screen.png",
    text: "Kart destelerini ana sayfadan görebilirsin.",
  },
];

const MOBILE_BREAKPOINT = 1023;

interface PostPracticeTutorialProps {
  onComplete: () => void;
}

export function PostPracticeTutorial({ onComplete }: PostPracticeTutorialProps) {
  const [step, setStep] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);
  const screen = TUTORIAL_SCREENS[step];
  const isLastStep = step === TUTORIAL_SCREENS.length - 1;

  useEffect(() => {
    setButtonVisible(false);
    const timer = setTimeout(() => setButtonVisible(true), 1300);
    return () => clearTimeout(timer);
  }, [step]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, []);

  if (!isMobile) {
    return null;
  }

  function handleNext() {
    if (isLastStep) {
      onComplete();
      return;
    }
    setStep((current) => current + 1);
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden",
        "bg-background px-6 py-8 text-center",
        "touch-none overscroll-contain",
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Learn practice tutorial"
    >
      <div className="flex max-w-sm flex-col items-center gap-6">
        <div className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
          <Image
            src={screen.image}
            alt=""
            fill
            className="object-contain"
            unoptimized
            priority
          />
        </div>

        <p className="text-xl font-bold leading-snug text-foreground sm:text-2xl">
          {screen.text}
        </p>

        <Button
          onClick={handleNext}
          className={cn(
            "h-14 w-full bg-brand px-6 text-base font-bold text-white hover:bg-brand-hover focus-visible:ring-brand",
            "transform transition-all duration-500 ease-out",
            buttonVisible
              ? "translate-y-0 scale-100 opacity-100"
              : "translate-y-4 scale-95 opacity-0 pointer-events-none",
          )}
        >
          {isLastStep ? "Bitir" : "İleri"}
        </Button>
      </div>

      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
        {TUTORIAL_SCREENS.map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              index === step ? "bg-brand" : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
