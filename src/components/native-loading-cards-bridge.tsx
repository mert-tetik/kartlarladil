"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { readLandingCardLanguage, subscribeLandingCardLanguageSync } from "@/app/components/landing-card-language";
import { useAuthSession } from "@/features/auth/auth-client";
import { selectNativeLoadingCards, selectNativeLoadingOfflineCards } from "@/features/inventory/native-loading-cards";
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
    };
  }
}

export function NativeLoadingCardsBridge() {
  const { locale } = useLocale();
  const { user } = useAuthSession();
  const inventory = useInventoryStore((state) => state.cards);
  const learningLanguage = useSyncExternalStore(
    subscribeLandingCardLanguageSync,
    () => user?.profile.preferredLanguageCode ?? readLandingCardLanguage() ?? locale,
    () => user?.profile.preferredLanguageCode ?? locale,
  );

  useEffect(() => {
    const nativeLoading = window.FoxiesDeckNativeLoading;
    if (!nativeLoading) return;

    nativeLoading.setPreferences?.(learningLanguage, locale);
    nativeLoading.setTitle?.(formatSuperWaterUppercaseText(locale, getNativeLoadingTitle(locale)));
    nativeLoading.setStatusTexts?.(
      JSON.stringify(getNativeLoadingStatuses(locale).map((status) => formatSuperWaterText(locale, status))),
    );
    let cancelled = false;
    void listOfflineInventorySnapshot(user?.id ?? "guest")
      .catch(() => null)
      .then((offlineEntries) => {
        if (cancelled) return;
        const cards = offlineEntries && offlineEntries.length > 0
          ? selectNativeLoadingOfflineCards(offlineEntries, learningLanguage, locale)
          : selectNativeLoadingCards(inventory, learningLanguage, locale);
        nativeLoading.setCards(JSON.stringify(cards));
      });

    return () => {
      cancelled = true;
    };
  }, [inventory, learningLanguage, locale, user?.id]);

  return null;
}
