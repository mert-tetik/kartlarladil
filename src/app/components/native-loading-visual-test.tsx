"use client";

import { useEffect, useState } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { readLandingCardLanguage } from "@/app/components/landing-card-language";
import { useLocale } from "@/i18n/locale-provider";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { selectNativeLoadingVocabularyCards } from "@/features/inventory/native-loading-cards";
import { getNativeLoadingStatuses, getNativeLoadingTitle } from "@/features/inventory/native-loading-copy";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";

const LOADING_PROGRESS = [8, 24, 48, 60, 68, 76, 88, 100] as const;

const STEP_DELAY_MS = 1200;

export function NativeLoadingVisualTest() {
  const [stepIndex, setStepIndex] = useState(0);
  const { locale } = useLocale();
  const step = {
    status: getNativeLoadingStatuses(locale)[stepIndex],
    progress: LOADING_PROGRESS[stepIndex],
  };
  const { user } = useAuthSession();
  const inventory = useInventoryStore((state) => state.cards);
  const [loadingCards, setLoadingCards] = useState(() => [] as ReturnType<typeof selectNativeLoadingVocabularyCards>);

  useEffect(() => {
    document.documentElement.classList.add("native-loading-visual-test-active");

    return () => document.documentElement.classList.remove("native-loading-visual-test-active");
  }, []);

  useEffect(() => {
    const learningLanguage = user?.profile.preferredLanguageCode ?? readLandingCardLanguage() ?? locale;
    setLoadingCards(selectNativeLoadingVocabularyCards(inventory, learningLanguage));
  }, [inventory, locale, user?.profile.preferredLanguageCode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, LOADING_PROGRESS.length - 1));
    }, STEP_DELAY_MS);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main
      aria-label="Native loading screen visual test"
      className="fixed !inset-0 !h-[100dvh] !w-[100vw] z-[2147483647] flex min-h-[100dvh] flex-col overflow-hidden bg-white text-white [padding-bottom:env(safe-area-inset-bottom)] [padding-top:env(safe-area-inset-top)]"
      data-native-loading-test
    >
      <section className="relative flex h-[calc(62%+30px)] min-h-0 flex-col items-center justify-center bg-white px-6 py-3">
        <p
          className="shrink-0 text-center font-super-water text-[2rem] leading-9 text-[#fe6507]"
          data-native-loading-title
        >
          {formatSuperWaterUppercaseText(locale, getNativeLoadingTitle(locale))}
        </p>
        <div className="mt-[10px] grid aspect-[300/424] w-full max-w-[300px] flex-none grid-cols-2 grid-rows-2 gap-2" data-native-loading-cards>
          {loadingCards.map((card) => (
            <div
              className="min-h-0 min-w-0"
              key={card.sourceKey}
              style={{ transform: "scale(0.94)", transformOrigin: "top center" }}
            >
              <VocabularyCardView
                card={card}
                className="h-full w-full"
                compact
                showActions={false}
                staticFace
              />
            </div>
          ))}
        </div>
      </section>

      <section className="relative flex h-[calc(38%-30px)] shrink-0 items-center justify-center bg-[#fe6507] px-6 [padding-bottom:env(safe-area-inset-bottom)]">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-10 z-0 h-10 w-full"
          preserveAspectRatio="none"
          viewBox="0 0 100 20"
        >
          <path d="M0 15 C25 0 70 30 100 9 V20 H0 Z" fill="#fe6507" />
        </svg>

        <div className="relative z-10 flex w-full max-w-[260px] -translate-y-2 flex-col items-center">
          <div aria-hidden="true" className="flex h-10 -translate-y-6 items-center justify-center gap-3">
            {[0, 1, 2].map((dot) => (
              <span
                className="native-loading-test-dot size-2.5 rounded-full bg-white/90 shadow-[0_4px_0_rgba(255,255,255,0.25)]"
                key={dot}
                style={{ animationDelay: `${dot * 140}ms` }}
              />
            ))}
          </div>

          <p
            aria-live="polite"
            className="min-h-8 text-center font-super-water text-2xl leading-8 drop-shadow-sm"
            data-native-loading-status
          >
            {formatSuperWaterText(locale, step.status)}
          </p>

          <div
            aria-label={`${step.progress}% loaded`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={step.progress}
            className="mt-1 h-4 w-full overflow-hidden rounded-full bg-white/25"
            data-native-loading-progress
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
              style={{ width: `${step.progress}%` }}
            />
          </div>
        </div>
      </section>

      <style jsx global>{`
        [data-native-loading-test] [data-native-loading-cards] .fd-card-design__front-fox {
          transform: translate(-50%, calc(-2.8125cqw + 4px));
        }

        .native-loading-test-dot {
          animation: native-loading-test-bounce 900ms ease-in-out infinite;
        }

        @keyframes native-loading-test-bounce {
          0%, 100% {
            transform: translateY(0) scale(1);
            opacity: 0.72;
          }
          45% {
            transform: translateY(-10px) scale(1.18);
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}
