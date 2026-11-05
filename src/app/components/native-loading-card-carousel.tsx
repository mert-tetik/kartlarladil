"use client";

import { useEffect, useState } from "react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import type { VocabularyCard } from "@/types/domain";

const CARDS_PER_GROUP = 4;
const GROUP_COUNT = 2;
const CYCLE_MS = 2000;
const CARD_MOTION_MS = 400;
const STAGGER_MS = 130;
const GROUP_MOTION_MS = CARD_MOTION_MS + STAGGER_MS * (CARDS_PER_GROUP - 1);
const HOLD_MS = CYCLE_MS - GROUP_MOTION_MS * 2;

type CarouselPhase = "hold" | "exit" | "enter";

interface NativeLoadingCardCarouselProps {
  cards: VocabularyCard[];
}

export function NativeLoadingCardCarousel({ cards }: NativeLoadingCardCarouselProps) {
  const [activeGroup, setActiveGroup] = useState(0);
  const [phase, setPhase] = useState<CarouselPhase>("hold");

  useEffect(() => {
    if (cards.length < CARDS_PER_GROUP * GROUP_COUNT) return;

    const duration = phase === "hold" ? HOLD_MS : GROUP_MOTION_MS;
    const timer = window.setTimeout(() => {
      if (phase === "hold") {
        setPhase("exit");
      } else if (phase === "exit") {
        setPhase("enter");
      } else {
        setActiveGroup((current) => (current + 1) % GROUP_COUNT);
        setPhase("hold");
      }
    }, duration);

    return () => window.clearTimeout(timer);
  }, [activeGroup, cards.length, phase]);

  if (cards.length < CARDS_PER_GROUP * GROUP_COUNT) return null;

  return (
    <div
      className="mt-[10px] grid aspect-[300/424] w-full max-w-[300px] flex-none grid-cols-2 grid-rows-2 gap-2"
      data-active-group={activeGroup}
      data-native-loading-cards
      data-transition-phase={phase}
    >
      {Array.from({ length: CARDS_PER_GROUP }, (_, slotIndex) => {
        const sourceCard = cards[activeGroup * CARDS_PER_GROUP + slotIndex];
        const destinationCard = cards[((activeGroup + 1) % GROUP_COUNT) * CARDS_PER_GROUP + slotIndex];

        return (
          <div
            className="relative min-h-0 min-w-0 overflow-visible"
            data-native-loading-card-slot={slotIndex}
            key={slotIndex}
          >
            {phase === "hold" ? (
              <div
                aria-hidden="true"
                data-card-motion="still"
                data-card-source={sourceCard.sourceKey}
              >
                <CardFace card={sourceCard} />
              </div>
            ) : phase === "exit" ? (
                <div
                  aria-hidden="true"
                  className="native-loading-card-motion native-loading-card-exit"
                  data-card-motion="exit"
                  data-card-source={sourceCard.sourceKey}
                  style={{ animationDelay: `${slotIndex * STAGGER_MS}ms` }}
                >
                  <CardFace card={sourceCard} />
                </div>
            ) : (
                <div
                  aria-hidden="true"
                  className="native-loading-card-motion native-loading-card-enter"
                  data-card-motion="enter"
                  data-card-source={destinationCard.sourceKey}
                  style={{ animationDelay: `${slotIndex * STAGGER_MS}ms` }}
                >
                  <CardFace card={destinationCard} />
                </div>
            )}
          </div>
        );
      })}

      <style jsx global>{`
        .native-loading-card-motion {
          position: absolute;
          inset: 0;
          will-change: transform;
        }

        .native-loading-card-exit {
          animation: native-loading-card-exit ${CARD_MOTION_MS}ms cubic-bezier(0.68, 0, 0.32, 1) both;
        }

        .native-loading-card-enter {
          animation: native-loading-card-enter ${CARD_MOTION_MS}ms cubic-bezier(0.68, 0, 0.32, 1) both;
        }

        @keyframes native-loading-card-exit {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-100vw - 100%)); }
        }

        @keyframes native-loading-card-enter {
          from { transform: translateX(calc(100vw + 100%)); }
          to { transform: translateX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .native-loading-card-exit {
            animation-name: native-loading-card-exit-reduced;
          }

          .native-loading-card-enter {
            animation-name: native-loading-card-enter-reduced;
          }

          @keyframes native-loading-card-exit-reduced {
            from { opacity: 1; }
            to { opacity: 0; }
          }

          @keyframes native-loading-card-enter-reduced {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}

function CardFace({ card }: { card: VocabularyCard }) {
  return (
    <div
      className="h-full w-full"
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
  );
}
