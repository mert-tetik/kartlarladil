"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { readLandingCardLanguage, subscribeLandingCardLanguageSync } from "@/app/components/landing-card-language";
import { useAuthSession } from "@/features/auth/auth-client";
import { isNativeLaunchDataReady } from "@/features/auth/native-launch-readiness";
import {
  completeNativeLoadingCards,
  getNativeLoadingDateKey,
  selectNativeLoadingDeckCards,
  selectNativeLoadingOfflineDeckCards,
} from "@/features/inventory/native-loading-cards";
import {
  getOrCreateNativeLoadingDailyDeckCards,
  readNativeLoadingDailyDeckCards,
} from "@/features/inventory/native-loading-daily-cache";
import { listOfflineInventorySnapshot } from "@/features/inventory/offline-card-storage";
import { getNativeLoadingStatuses, getNativeLoadingTitle } from "@/features/inventory/native-loading-copy";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { formatSuperWaterText, formatSuperWaterUppercaseText } from "@/lib/super-water";

declare global {
    interface Window {
    FoxiesDeckNativeLoading?: {
      setCards: (cardsJson: string) => void;
      setPreferences?: (learningLanguage: string, uiLocale: string) => void;
      setTitle?: (title: string) => void;
      setStatusTexts?: (statusesJson: string) => void;
      setBootstrapReady?: () => void;
      setEssentialDataReady?: () => void;
      setProfileDataReady?: () => void;
      setPerformanceDiagnosticsContext?: (enabled: boolean, ownerHash: string) => void;
      getPerformanceDeviceInfo?: () => string;
      getPendingPerformanceSnapshots?: () => string;
      acknowledgePerformanceSnapshot?: (eventId: string) => void;
    };
  }
}

export function NativeLoadingCardsBridge() {
  const { locale } = useLocale();
  const localizedStatusTexts = useMemo(
    () => getNativeLoadingStatuses(locale).map((status) => formatSuperWaterText(locale, status)),
    [locale],
  );
  const { user, isSessionReady } = useAuthSession();
  const inventory = useInventoryStore((state) => state.cards);
  const inventoryHydrated = useInventoryStore((state) => state.hydrated);
  const ownerUserId = useInventoryStore((state) => state.ownerUserId);
  const learningLanguage = useSyncExternalStore(
    subscribeLandingCardLanguageSync,
    () => user?.profile.preferredLanguageCode ?? readLandingCardLanguage() ?? locale,
    () => user?.profile.preferredLanguageCode ?? locale,
  );

  useEffect(() => {
    const nativeLoading = window.FoxiesDeckNativeLoading;
    if (!nativeLoading) return;
    if (!isSessionReady) return;

    nativeLoading.setPreferences?.(learningLanguage, locale);
    if (user) nativeLoading.setProfileDataReady?.();
    nativeLoading.setTitle?.(formatSuperWaterUppercaseText(locale, getNativeLoadingTitle(locale)));
    nativeLoading.setStatusTexts?.(JSON.stringify(localizedStatusTexts));
    const dateKey = getNativeLoadingDateKey();
    const cacheIdentity = {
      profileId: user?.id ?? "guest",
      learningLanguage,
      locale,
      dateKey,
    };
    const cachedDeckCards = readNativeLoadingDailyDeckCards(cacheIdentity);
    const sendDeckCards = (deckCards: ReturnType<typeof selectNativeLoadingDeckCards>) => {
      nativeLoading.setCards(JSON.stringify(
        completeNativeLoadingCards(deckCards, learningLanguage, locale, dateKey),
      ));
    };
    if (cachedDeckCards !== null) sendDeckCards(cachedDeckCards);

    const launchDataReady = isNativeLaunchDataReady({
      isSessionReady,
      userId: user?.id ?? null,
      inventoryHydrated,
      ownerUserId,
    });

    if (launchDataReady) {
      const dailyDeckCards = getOrCreateNativeLoadingDailyDeckCards(cacheIdentity, () =>
        selectNativeLoadingDeckCards(
          inventory,
          learningLanguage,
          locale,
          dateKey,
          cacheIdentity.profileId,
        ),
      );
      sendDeckCards(dailyDeckCards);
      nativeLoading.setEssentialDataReady?.();
      return;
    }

    if (cachedDeckCards !== null) return;

    let cancelled = false;
    void listOfflineInventorySnapshot(cacheIdentity.profileId)
      .catch(() => null)
      .then((offlineEntries) => {
        if (cancelled) return;
        const offlineDeckCards = offlineEntries?.length
          ? selectNativeLoadingOfflineDeckCards(
            offlineEntries,
            learningLanguage,
            locale,
            dateKey,
            cacheIdentity.profileId,
          )
          : [];
        sendDeckCards(offlineDeckCards.length > 0
          ? offlineDeckCards
          : selectNativeLoadingDeckCards(
            inventory,
            learningLanguage,
            locale,
            dateKey,
            cacheIdentity.profileId,
          ));
      });

    return () => {
      cancelled = true;
    };
  }, [inventory, inventoryHydrated, isSessionReady, learningLanguage, locale, localizedStatusTexts, ownerUserId, user?.id]);

  return null;
}
