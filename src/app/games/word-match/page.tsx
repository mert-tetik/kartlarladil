"use client";

import { WordMatchGame } from "@/features/games/components/word-match-game";
import { useGameProgressStore } from "@/features/games/game-progress-store";

export default function WordMatchPage() {
  const currentLevel = useGameProgressStore((state) => state.getProgress("wordMatch").currentLevel);
  return <WordMatchGame initialLevel={currentLevel} />;
}
