"use client";

import { useCallback, useState } from "react";
import { VOCABULARY_CARDS } from "@/data/cards";
import {
  CardProgressReveal,
  type QuizCardProgressRevealItem,
  type QuizCardProgressFeedback,
} from "@/features/quiz/components/quiz-station";
import { getTierRequirement } from "@/features/quiz/quiz-engine";
import type { InventoryCard, VocabularyCard } from "@/types/domain";

const TEST_TIMESTAMP = "2026-01-01T00:00:00.000Z";

function pickRandomCard(previousId?: string): VocabularyCard | null {
  const pool = VOCABULARY_CARDS.filter((card) => card.id !== previousId);
  const source = pool.length > 0 ? pool : VOCABULARY_CARDS;

  return source[Math.floor(Math.random() * source.length)] ?? null;
}

function createTestItem(card: VocabularyCard): QuizCardProgressRevealItem {
  const requirement = getTierRequirement(card.tier);
  const baseCount = Math.max(0, requirement - 2);
  const inventoryCard: InventoryCard = {
    cardId: card.id,
    status: "active",
    correctCount: baseCount,
    addedAt: TEST_TIMESTAMP,
  };

  return { card, inventoryCard };
}

function createTestFeedback(card: VocabularyCard): QuizCardProgressFeedback {
  const requirement = getTierRequirement(card.tier);
  const baseCount = Math.max(0, requirement - 2);

  return {
    id: `card-progress-test:${card.id}`,
    cardId: card.id,
    stage: "appearing",
    baseCount,
    targetCount: Math.min(requirement, baseCount + 1),
  };
}

export function CardProgressRevealTest() {
  const [card, setCard] = useState<VocabularyCard | null>(VOCABULARY_CARDS[0] ?? null);
  const [round, setRound] = useState(0);

  const handleContinue = useCallback(() => {
    setCard((currentCard) => pickRandomCard(currentCard?.id));
    setRound((currentRound) => currentRound + 1);
  }, []);

  if (!card) {
    return <div className="fixed inset-0 bg-background" data-card-progress-test />;
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-background"
      data-card-progress-test
      data-card-progress-test-round={round}
    >
      <CardProgressReveal
        key={`${card.id}-${round}`}
        item={createTestItem(card)}
        feedback={createTestFeedback(card)}
        enterWithCss={false}
        onContinue={handleContinue}
      />
    </div>
  );
}
