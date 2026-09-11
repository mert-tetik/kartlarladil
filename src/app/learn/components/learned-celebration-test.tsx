"use client";

import { useCallback, useEffect, useState } from "react";
import { VOCABULARY_CARDS } from "@/data/cards";
import { CelebrationView } from "@/features/quiz/components/quiz-station";
import type { VocabularyCard } from "@/types/domain";

function pickRandomCard(previousId?: string): VocabularyCard | null {
  const pool = VOCABULARY_CARDS.filter((card) => card.id !== previousId);
  const source = pool.length > 0 ? pool : VOCABULARY_CARDS;

  if (source.length === 0) {
    return null;
  }

  return source[Math.floor(Math.random() * source.length)] ?? null;
}

export function LearnedCelebrationTest() {
  const [round, setRound] = useState(0);
  const [card, setCard] = useState<VocabularyCard | null>(null);

  useEffect(() => {
    setCard(pickRandomCard());
  }, []);

  const handleContinue = useCallback(() => {
    setCard((currentCard) => pickRandomCard(currentCard?.id));
    setRound((currentRound) => currentRound + 1);
  }, []);

  if (!card) {
    return <div className="fixed inset-0 bg-background" data-learned-celebration-test />;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background" data-learned-celebration-test>
      <CelebrationView
        key={`${card.id}-${round}`}
        card={card}
        basePoints={0}
        onContinue={handleContinue}
      />
    </div>
  );
}
