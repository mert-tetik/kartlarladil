"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { readLandingCardLanguage, subscribeLandingCardLanguageSync } from "@/app/components/landing-card-language";
import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { createOfflineInventorySnapshot } from "@/features/inventory/offline-inventory-snapshot";
import { saveOfflineInventorySnapshot } from "@/features/inventory/offline-card-storage";
import { useLocale } from "@/i18n/locale-provider";
import type { LanguageCode } from "@/types/domain";

export function OfflineInventorySync() {
  const { user } = useAuthSession();
  const { locale } = useLocale();
  const pathname = usePathname();
  const cards = useInventoryStore((state) => state.cards);
  const hydrated = useInventoryStore((state) => state.hydrated);
  const cloudEnabled = useInventoryStore((state) => state.cloudEnabled);
  const cloudLoading = useInventoryStore((state) => state.cloudLoading);
  const cloudLoadComplete = useInventoryStore((state) => state.cloudLoadComplete);
  const ownerUserId = useInventoryStore((state) => state.ownerUserId);
  const userId = user?.id ?? null;
  const selectedCardLanguage = useSyncExternalStore<LanguageCode>(
    subscribeLandingCardLanguageSync,
    () => readLandingCardLanguage() ?? user?.profile.preferredLanguageCode ?? "en",
    () => user?.profile.preferredLanguageCode ?? "en",
  );

  useEffect(() => {
    if (pathname.startsWith("/visual-test-")) return;
    if (!hydrated || (cloudEnabled && (cloudLoading || !cloudLoadComplete))) return;
    if (userId && (!cloudEnabled || !cloudLoadComplete || cloudLoading || ownerUserId !== userId)) return;
    if (!userId && (cloudEnabled || ownerUserId !== null)) return;

    const snapshot = createOfflineInventorySnapshot({
      inventory: cards,
      nativeLanguage: locale,
    });
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void saveOfflineInventorySnapshot({
        profileId: userId ?? "guest",
        nativeLanguage: locale,
        cardLanguage: selectedCardLanguage,
        cards: snapshot.cards,
        complete: snapshot.complete,
      }).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          console.error("[FoxiesDeck offline] Inventory snapshot was not saved.");
        } else if (cards.length > 0 && snapshot.cards.length === 0) {
          console.warn("[FoxiesDeck offline] No saved cards could be resolved for the offline snapshot.", {
            inventoryCount: cards.length,
            allInventoryCardsResolved: snapshot.complete,
          });
        }
      }).catch((error: unknown) => {
        if (!cancelled) console.error("[FoxiesDeck offline] Inventory snapshot sync failed.", error);
      });
    }, 100);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cards, cloudEnabled, cloudLoadComplete, cloudLoading, hydrated, locale, ownerUserId, pathname, selectedCardLanguage, userId]);

  return null;
}
