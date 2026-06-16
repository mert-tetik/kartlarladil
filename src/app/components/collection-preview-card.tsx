"use client";

import { useEffect, useRef, useState } from "react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import { cn } from "@/lib/utils";
import type { VocabularyCard } from "@/types/domain";

export function CollectionPreviewCard({ card, index }: { card: VocabularyCard; index: number }) {
  const [face, setFace] = useState<"front" | "back">("back");
  const [revealed, setRevealed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (revealed) return;

    const element = ref.current;
    if (!element) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => {
            setFace("front");
            setRevealed(true);
          }, 2000);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [revealed]);

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={revealed ? 0 : -1}
      aria-label={revealed ? "Flip card" : "Card preview"}
      aria-pressed={face === "front"}
      onClick={() => {
        if (!revealed) return;
        setFace((current) => (current === "front" ? "back" : "front"));
      }}
      onKeyDown={(event) => {
        if (!revealed) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setFace((current) => (current === "front" ? "back" : "front"));
        }
      }}
      className={cn(
        "rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950",
        revealed && "cursor-pointer",
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <VocabularyCardView card={card} face={face} flippable={false} />
    </div>
  );
}
