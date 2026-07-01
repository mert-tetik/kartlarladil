"use client";

import { WordChallengeGame } from "@/features/games/components/word-challenge-game";
import { useGameProgressStore } from "@/features/games/game-progress-store";

export default function WordChallengePage() {
  const currentLevel = useGameProgressStore((state) => state.getProgress("wordChallenge").currentLevel);
  return <WordChallengeGame initialLevel={currentLevel} />;
}
