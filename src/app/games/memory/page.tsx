"use client";

import { MemoryGameBoard } from "@/features/games/components/memory-game-board";
import { useGameProgressStore } from "@/features/games/game-progress-store";

export default function MemoryGamePage() {
  const currentLevel = useGameProgressStore((state) => state.getProgress("memory").currentLevel);
  return <MemoryGameBoard initialLevel={currentLevel} />;
}
