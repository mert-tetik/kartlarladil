"use client";

import { useEffect, useMemo } from "react";
import {
  enqueueCardPronunciation,
  hydrateCardPronunciationCache,
  shouldQueueCardPronunciation,
} from "@/features/cards/card-pronunciation-client";
import { localCardRepository } from "@/features/cards/card-repository";
import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";

export function CardPronunciationQueue() {
  const { user } = useAuthSession();
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudEnabled = useInventoryStore((state) => state.cloudEnabled);
  const cloudLoading = useInventoryStore((state) => state.cloudLoading);
  const ownerUserId = useInventoryStore((state) => state.ownerUserId);
  const pendingCardIds = useInventoryStore((state) => state.pendingCardIds);
  const cardIds = useMemo(() => cards.map((card) => card.cardId), [cards]);

  useEffect(() => {
    hydrateCardPronunciationCache();
  }, []);

  useEffect(() => {
    if (!user || !hydrated || !cloudEnabled || cloudLoading || ownerUserId !== user.id) return;

    for (const cardId of cardIds) {
      if (pendingCardIds.has(cardId)) continue;

      const card = localCardRepository.findById(cardId);
      if (card && shouldQueueCardPronunciation(card)) {
        enqueueCardPronunciation(card.sourceKey);
      }
    }
  }, [cardIds, cloudEnabled, cloudLoading, hydrated, ownerUserId, pendingCardIds, user]);

  return null;
}
