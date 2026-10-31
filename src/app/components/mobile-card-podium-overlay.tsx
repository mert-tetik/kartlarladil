"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, MessageCircleQuestion, X } from "lucide-react";
import { VocabularyCardView } from "@/features/cards/components/vocabulary-card-view";
import {
  CardGrammarDetailsButton,
  CardGrammarDetailsOverlay,
} from "@/features/cards/components/card-grammar-details-overlay";
import { useAskOverlay } from "@/features/ask/components/ask-overlay-provider";
import { useRequireAuthAction } from "@/features/auth/auth-client";
import { useAuthSession } from "@/features/auth/auth-client";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useAppMessage } from "@/components/app-message-provider";
import { getCardDefinition } from "@/data/card-definitions";
import { getStudyLocale } from "@/features/cards/card-localization";
import { useLocale, useT } from "@/i18n/locale-provider";
import { markCardLearnedWithGemAction, removeCardWithGemAction } from "@/features/gems/gem-actions";
import { GEM_ASSETS, GEM_COSTS, getMarkLearnedGemCost, type GemType } from "@/features/gems/gem-types";
import { getCardDesignTierPalette } from "@/features/cards/card-design-tier-palette";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { formatAddedAt, formatNumber } from "@/i18n/labels";
import { playSoundEffect } from "@/lib/sound-effects";
import { vibrate } from "@/lib/vibration";
import { cn } from "@/lib/utils";
import type { InventoryCardView } from "@/features/inventory/inventory-selectors";

/**
 * Card Podium is the owned-card detail overlay for the landing-page collections.
 * It intentionally follows the full-screen, swipe-through presentation of
 * MobileRankInfoSheet; the current collection filters define the carousel.
 * Cards that are not owned (including group-add previews) use
 * MobileUnownedCardDisplaySheet instead.
 */

const SWIPE_THRESHOLD = 48;
const CARD_PODIUM_OPEN_DURATION = 1900;
const CARD_PODIUM_CLOSE_DURATION = 900;
const CARD_PODIUM_SNAP_DURATION = 240;
const PODIUM_CENTER_SLOT_INDEX = 4;
const PODIUM_SLOT_OFFSETS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;
const PODIUM_IMAGE_BY_TIER: Record<InventoryCardView["card"]["tier"], string> = {
  A1: "/card-podiums/a1-green-v2.png",
  A2: "/card-podiums/a2-turquoise-v2.png",
  B1: "/card-podiums/b1-purple-v2.png",
  B2: "/card-podiums/b2-orange-v2.png",
  C1: "/card-podiums/c1-red-v2.png",
};

const CARD_STATUS_BADGE_BY_STATUS = {
  active: "/card-status/kart_ogreniliyor_madalyasi.png",
  learned: "/card-status/kart_ogrenildi_madalyasi.png",
} as const;

type ReviewSection = "active" | "learned";

interface CardPointerDrag {
  pointerId: number;
  startX: number;
  moved: boolean;
}

interface PodiumBackgroundPalette {
  shellEnd: string;
  backdrop: string;
}

const REVIEW_BACKGROUND_BY_SECTION: Record<ReviewSection, PodiumBackgroundPalette> = {
  active: {
    shellEnd: "#10b981",
    backdrop: "#064e3b",
  },
  learned: {
    shellEnd: "#0ea5e9",
    backdrop: "#0c4a6e",
  },
};

interface PodiumBackgroundTransition {
  from: PodiumBackgroundPalette;
  to: PodiumBackgroundPalette;
  key: number;
}

interface MobileCardPodiumOverlayProps {
  items: InventoryCardView[];
  reviewActiveItems?: InventoryCardView[];
  reviewLearnedItems?: InventoryCardView[];
  selectedCardId: string | null;
  isOpen: boolean;
  onSelectedCardChange: (cardId: string) => void;
  onClose: () => void;
  mode?: "collection" | "review";
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function tierBackdropHex(hex: string) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;

  const saturation = 0.3;
  const value = 0.3;
  const chroma = value * saturation;
  const hueSector = hue / 60;
  const secondComponent = chroma * (1 - Math.abs((hueSector % 2) - 1));
  const match = value - chroma;

  let redPrime = 0;
  let greenPrime = 0;
  let bluePrime = 0;
  if (hueSector < 1) [redPrime, greenPrime, bluePrime] = [chroma, secondComponent, 0];
  else if (hueSector < 2) [redPrime, greenPrime, bluePrime] = [secondComponent, chroma, 0];
  else if (hueSector < 3) [redPrime, greenPrime, bluePrime] = [0, chroma, secondComponent];
  else if (hueSector < 4) [redPrime, greenPrime, bluePrime] = [0, secondComponent, chroma];
  else if (hueSector < 5) [redPrime, greenPrime, bluePrime] = [secondComponent, 0, chroma];
  else [redPrime, greenPrime, bluePrime] = [chroma, 0, secondComponent];

  return `#${[redPrime, greenPrime, bluePrime]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function MobileCardPodiumOverlay({
  items: collectionItems,
  reviewActiveItems = [],
  reviewLearnedItems = [],
  selectedCardId,
  isOpen,
  onSelectedCardChange,
  onClose,
  mode = "collection",
}: MobileCardPodiumOverlayProps) {
  const { locale } = useLocale();
  const t = useT();
  const { showMessage } = useAppMessage();
  const { openAsk } = useAskOverlay();
  const requireAuth = useRequireAuthAction();
  const {
    user,
    refreshProfile,
    reserveGemSpend,
    settleGemSpend,
    rollbackGemSpend,
  } = useAuthSession();
  const loadCloudInventory = useInventoryStore((state) => state.loadCloudInventory);
  const optimisticallyRemoveCard = useInventoryStore((state) => state.optimisticallyRemoveCard);
  const optimisticallyMarkCardLearned = useInventoryStore((state) => state.optimisticallyMarkCardLearned);
  const settleOptimisticCardMutation = useInventoryStore((state) => state.settleOptimisticCardMutation);
  const rollbackOptimisticCardMutation = useInventoryStore((state) => state.rollbackOptimisticCardMutation);
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const [introActive, setIntroActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [face, setFace] = useState<"front" | "back">("front");
  const [grammarDetailsOpen, setGrammarDetailsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<GemType | null>(null);
  const [busy, setBusy] = useState(false);
  const podiumTrackRef = useRef<HTMLDivElement | null>(null);
  const podiumTrackContentRef = useRef<HTMLDivElement | null>(null);
  const pointerDragRef = useRef<CardPointerDrag | null>(null);
  const currentIndexRef = useRef(0);
  const snapTimerRef = useRef<number | null>(null);
  const pendingSnapIndexRef = useRef<number | null>(null);
  const queuedSnapIndexRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);
  const hasBeenOpenedRef = useRef(false);
  const previousBackgroundRef = useRef<PodiumBackgroundPalette | null>(null);
  const backgroundTransitionTimerRef = useRef<number | null>(null);
  const backgroundTransitionKeyRef = useRef(0);
  const [backgroundTransition, setBackgroundTransition] = useState<PodiumBackgroundTransition | null>(null);
  const [backgroundTargetIndex, setBackgroundTargetIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [statusBadgeVisible, setStatusBadgeVisible] = useState(false);
  const isReviewMode = mode === "review";
  const [reviewSection, setReviewSection] = useState<ReviewSection>("active");
  const [reviewIntro, setReviewIntro] = useState(false);
  const [isReviewPressed, setIsReviewPressed] = useState(false);
  const reviewItems = reviewSection === "active" ? reviewActiveItems : reviewLearnedItems;
  const items = isReviewMode ? reviewItems : collectionItems;

  useEffect(() => {
    if (isOpen) {
      hasBeenOpenedRef.current = true;
      pointerDragRef.current = null;
      setIsDragging(false);
      setStatusBadgeVisible(false);
      if (isReviewMode) {
        setReviewSection(reviewActiveItems.length > 0 ? "active" : "learned");
        setReviewIntro(true);
      } else {
        setReviewIntro(false);
      }

      let openFrame: number | null = null;
      let introTimer: number | null = null;
      const mountFrame = window.requestAnimationFrame(() => {
        setMounted(true);
        setPhase("opening");
        setIntroActive(true);
        openFrame = window.requestAnimationFrame(() => {
          setPhase("open");
          setStatusBadgeVisible(true);
        });
        introTimer = window.setTimeout(() => setIntroActive(false), CARD_PODIUM_OPEN_DURATION);
      });

      return () => {
        window.cancelAnimationFrame(mountFrame);
        if (openFrame !== null) window.cancelAnimationFrame(openFrame);
        if (introTimer !== null) window.clearTimeout(introTimer);
      };
    }

    if (!hasBeenOpenedRef.current) return;

    setStatusBadgeVisible(false);
    const closeFrame = window.requestAnimationFrame(() => setPhase("closing"));
    const closeTimer = window.setTimeout(() => {
      setMounted(false);
      hasBeenOpenedRef.current = false;
    }, CARD_PODIUM_CLOSE_DURATION);

    return () => {
      window.cancelAnimationFrame(closeFrame);
      window.clearTimeout(closeTimer);
    };
  }, [isOpen, isReviewMode, reviewActiveItems.length]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = items.findIndex(({ card }) => card.id === selectedCardId || card.sourceKey === selectedCardId);
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    currentIndexRef.current = nextIndex;
    setIndex(nextIndex);
    setBackgroundTargetIndex(nextIndex);
    setFace("front");
    setGrammarDetailsOpen(false);
    setConfirmation(null);
  }, [isOpen, items, selectedCardId]);

  const currentIndex = Math.max(0, Math.min(index, items.length - 1));
  const currentItem = items[currentIndex];
  const currentCard = currentItem?.card;
  const currentInventory = currentItem?.inventory;
  const palette = currentCard ? getCardDesignTierPalette(currentCard.tier) : null;
  const backgroundItem = items[Math.max(0, Math.min(backgroundTargetIndex, items.length - 1))];
  const backgroundCard = backgroundItem?.card ?? currentCard;
  const tierBackgroundPalette = backgroundCard ? getCardDesignTierPalette(backgroundCard.tier) : palette;
  const backgroundPalette = isReviewMode ? REVIEW_BACKGROUND_BY_SECTION[reviewSection] : tierBackgroundPalette;
  const backgroundShellEnd = backgroundPalette?.shellEnd ?? null;
  const backgroundBackdrop = backgroundShellEnd ? tierBackdropHex(backgroundShellEnd) : null;
  const canNavigate = items.length > 1;

  useLayoutEffect(() => {
    if (backgroundTransitionTimerRef.current !== null) {
      window.clearTimeout(backgroundTransitionTimerRef.current);
      backgroundTransitionTimerRef.current = null;
    }

    if (!isOpen || !backgroundShellEnd || !backgroundBackdrop || isReviewMode) {
      previousBackgroundRef.current = null;
      setBackgroundTransition(null);
      return;
    }

    const nextBackground: PodiumBackgroundPalette = {
      shellEnd: backgroundShellEnd,
      backdrop: backgroundBackdrop,
    };
    const previousBackground = previousBackgroundRef.current;
    previousBackgroundRef.current = nextBackground;

    if (!previousBackground || previousBackground.shellEnd === nextBackground.shellEnd) {
      setBackgroundTransition(null);
      return;
    }

    const transitionKey = backgroundTransitionKeyRef.current + 1;
    backgroundTransitionKeyRef.current = transitionKey;
    setBackgroundTransition({
      from: previousBackground,
      to: nextBackground,
      key: transitionKey,
    });

    backgroundTransitionTimerRef.current = window.setTimeout(() => {
      backgroundTransitionTimerRef.current = null;
      setBackgroundTransition((current) => current?.key === transitionKey ? null : current);
    }, 460);

    return () => {
      if (backgroundTransitionTimerRef.current !== null) {
        window.clearTimeout(backgroundTransitionTimerRef.current);
        backgroundTransitionTimerRef.current = null;
      }
    };
  }, [backgroundBackdrop, backgroundShellEnd, isOpen, isReviewMode]);

  const getTrackWidth = useCallback(() => {
    const track = podiumTrackRef.current;
    if (!track) return 0;

    return track.clientWidth || track.getBoundingClientRect().width || window.innerWidth;
  }, []);

  const updateNearestBackgroundCard = useCallback((nearestSlot: number) => {
    if (items.length === 0) return;

    const nearestIndex = Math.max(
      0,
      Math.min(items.length - 1, currentIndexRef.current + nearestSlot - 1),
    );
    setBackgroundTargetIndex((current) => current === nearestIndex ? current : nearestIndex);
  }, [items.length]);

  const cancelSnap = useCallback(() => {
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
    pendingSnapIndexRef.current = null;
    queuedSnapIndexRef.current = null;
  }, []);

  const resetTrackPosition = useCallback((behavior: ScrollBehavior = "auto") => {
    const track = podiumTrackContentRef.current;
    const trackWidth = getTrackWidth();
    if (!track || !trackWidth) return;

    track.style.transition = behavior === "smooth"
      ? `transform ${CARD_PODIUM_SNAP_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`
      : "none";
    track.style.transform = `translate3d(${-trackWidth * PODIUM_CENTER_SLOT_INDEX}px, 0, 0)`;
  }, [getTrackWidth]);

  const commitCardIndex = useCallback((targetIndex: number) => {
    const nextIndex = Math.max(0, Math.min(items.length - 1, targetIndex));
    setBackgroundTargetIndex(nextIndex);
    if (currentIndexRef.current === nextIndex) return;

    currentIndexRef.current = nextIndex;
    setIndex(nextIndex);
    const nextCard = items[nextIndex]?.card;
    if (nextCard) onSelectedCardChange(nextCard.id);
    setFace("front");
    setGrammarDetailsOpen(false);
    setConfirmation(null);
    vibrate("tap");
    playSoundEffect("rank-highlight");
  }, [items, onSelectedCardChange]);

  const snapToCard = useCallback((targetIndex: number) => {
    const track = podiumTrackContentRef.current;
    const trackWidth = getTrackWidth();
    if (!track || !trackWidth || items.length === 0) return;

    cancelSnap();
    const nextIndex = Math.max(0, Math.min(items.length - 1, targetIndex));
    const current = currentIndexRef.current;
    const offset = nextIndex - current;
    const targetTransform = -trackWidth * (PODIUM_CENTER_SLOT_INDEX + offset);
    pendingSnapIndexRef.current = nextIndex;
    setBackgroundTargetIndex(nextIndex);
    setStatusBadgeVisible(false);
    track.style.transition = `transform ${CARD_PODIUM_SNAP_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    track.style.transform = `translate3d(${targetTransform}px, 0, 0)`;

    snapTimerRef.current = window.setTimeout(() => {
      snapTimerRef.current = null;
      if (pendingSnapIndexRef.current !== nextIndex) return;
      pendingSnapIndexRef.current = null;
      if (nextIndex !== currentIndexRef.current) commitCardIndex(nextIndex);

      const queuedIndex = queuedSnapIndexRef.current;
      queuedSnapIndexRef.current = null;
      if (queuedIndex !== null && queuedIndex !== nextIndex) {
        window.requestAnimationFrame(() => {
          if (pendingSnapIndexRef.current === null) snapToCard(queuedIndex);
        });
      } else {
        setStatusBadgeVisible(true);
      }
    }, CARD_PODIUM_SNAP_DURATION);
  }, [cancelSnap, commitCardIndex, getTrackWidth, items.length]);

  const rebasePendingSnap = useCallback(() => {
    const pendingIndex = pendingSnapIndexRef.current;
    if (pendingIndex === null) return;

    cancelSnap();
    flushSync(() => {
      commitCardIndex(pendingIndex);
    });
    resetTrackPosition("auto");
  }, [cancelSnap, commitCardIndex, resetTrackPosition]);

  const move = useCallback((direction: -1 | 1) => {
    const pendingIndex = pendingSnapIndexRef.current;
    if (pendingIndex !== null) {
      const current = currentIndexRef.current;
      const nextIndex = Math.max(0, Math.min(items.length - 1, pendingIndex + direction));
      if (Math.abs(nextIndex - current) > PODIUM_CENTER_SLOT_INDEX) {
        rebasePendingSnap();
      }
      snapToCard(nextIndex);
      return;
    }

    const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndexRef.current + direction));
    snapToCard(nextIndex);
  }, [items.length, rebasePendingSnap, snapToCard]);

  useLayoutEffect(() => {
    if (!isOpen || !mounted) return;

    resetTrackPosition("auto");
  }, [currentIndex, isOpen, items.length, mounted, resetTrackPosition, selectedCardId]);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    const handleResize = () => resetTrackPosition("auto");
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, mounted, resetTrackPosition]);

  useEffect(() => {
    if (isOpen) return;
    cancelSnap();
    pointerDragRef.current = null;
    setIsDragging(false);
  }, [cancelSnap, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (!isReviewMode && event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      } else if (!isReviewMode && event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isReviewMode, move, onClose]);

  function startReviewSection(nextSection: ReviewSection) {
    const nextItems = nextSection === "active" ? reviewActiveItems : reviewLearnedItems;
    const firstCard = nextItems[0]?.card;
    if (!firstCard) return;

    cancelSnap();
    currentIndexRef.current = 0;
    setIndex(0);
    setBackgroundTargetIndex(0);
    setFace("front");
    setGrammarDetailsOpen(false);
    setConfirmation(null);
    setStatusBadgeVisible(false);
    setReviewSection(nextSection);
    setReviewIntro(true);
    onSelectedCardChange(firstCard.id);
  }

  function revealReviewCards() {
    setReviewIntro(false);
    setStatusBadgeVisible(true);
  }

  function advanceReviewImmediately() {
    cancelSnap();

    const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndexRef.current + 1));
    if (nextIndex === currentIndexRef.current) return;

    currentIndexRef.current = nextIndex;
    setIndex(nextIndex);
    setBackgroundTargetIndex(nextIndex);
    setFace("front");
    setGrammarDetailsOpen(false);
    setConfirmation(null);

    const nextCard = items[nextIndex]?.card;
    if (nextCard) onSelectedCardChange(nextCard.id);
  }

  function handleReviewTap(event: ReactMouseEvent<HTMLElement>) {
    if (!isReviewMode || (event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    vibrate("tutorial-next");
    playSoundEffect("rank-highlight");

    if (reviewIntro) {
      revealReviewCards();
      return;
    }

    if (reviewSection === "active" && currentIndexRef.current >= items.length - 1 && reviewLearnedItems.length > 0) {
      startReviewSection("learned");
      return;
    }

    advanceReviewImmediately();
  }

  function handleReviewPressStart(event: ReactPointerEvent<HTMLElement>) {
    if (!isReviewMode || (event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsReviewPressed(true);
  }

  function handleReviewPressEnd(event: ReactPointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsReviewPressed(false);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    const track = podiumTrackRef.current;
    if (!track) return;

    event.preventDefault();
    rebasePendingSnap();
    cancelSnap();
    setStatusBadgeVisible(false);
    const trackContent = podiumTrackContentRef.current;
    if (trackContent) {
      trackContent.style.transition = "none";
    }
    pointerDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      moved: false,
    };
    setIsDragging(true);
    didSwipeRef.current = false;

    if (typeof track.setPointerCapture === "function") {
      track.setPointerCapture(event.pointerId);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = pointerDragRef.current;
    const track = podiumTrackRef.current;
    const trackContent = podiumTrackContentRef.current;
    if (!drag || !track || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) >= 6) drag.moved = true;
    didSwipeRef.current = drag.moved;
    if (!drag.moved) return;

    event.preventDefault();
    const trackWidth = getTrackWidth();
    if (!trackWidth || !trackContent) return;

    const minDelta = currentIndexRef.current > 0 ? -trackWidth : 0;
    const maxDelta = currentIndexRef.current < items.length - 1 ? trackWidth : 0;
    const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaX));
    trackContent.style.transform = `translate3d(${-trackWidth * PODIUM_CENTER_SLOT_INDEX + clampedDelta}px, 0, 0)`;
    updateNearestBackgroundCard(Math.max(0, Math.min(2, Math.round(1 - clampedDelta / trackWidth))));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = pointerDragRef.current;
    const track = podiumTrackRef.current;
    if (!drag || !track || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    pointerDragRef.current = null;
    setIsDragging(false);

    if (typeof track.releasePointerCapture === "function" && track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId);
    }

    if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndexRef.current + (deltaX < 0 ? 1 : -1)));
      snapToCard(nextIndex);
      return;
    }

    snapToCard(currentIndexRef.current);
  }

  function handlePointerCancel() {
    const track = podiumTrackRef.current;
    if (!pointerDragRef.current || !track) return;

    pointerDragRef.current = null;
    setIsDragging(false);
    snapToCard(currentIndexRef.current);
  }

  function handleAskClick() {
    if (!currentCard) return;
    requireAuth(() => {
      onClose();
      openAsk({ contextLanguage: currentCard.language, initialTerm: currentCard.term });
    }, { nextPath: `/ask/${currentCard.language}?term=${encodeURIComponent(currentCard.term)}` });
  }

  function requestGemAction(type: GemType) {
    if (!user) {
      requireAuth(() => undefined, { nextPath: "/" });
      return;
    }
    setConfirmation(type);
  }

  async function confirmGemAction() {
    if (!confirmation || !user || !currentCard || !currentInventory || busy) return;
    const confirmedType = confirmation;
    const cost = confirmedType === "blue" ? GEM_COSTS.removeCard.amount : getMarkLearnedGemCost(currentCard.tier);
    const reservation = reserveGemSpend(confirmedType, cost);
    if (!reservation) {
      showMessage("insufficient_gems", "error");
      return;
    }

    const mutation = confirmedType === "blue"
      ? optimisticallyRemoveCard(currentInventory.cardId)
      : optimisticallyMarkCardLearned(currentInventory.cardId);
    if (!mutation) {
      rollbackGemSpend(reservation);
      showMessage(t("inventory.error.operationFailed"), "error");
      return;
    }

    setConfirmation(null);
    setBusy(true);
    playSoundEffect("gem-spend");
    vibrate("tap");
    void (async () => {
      try {
        const result = confirmedType === "blue"
          ? await removeCardWithGemAction(currentCard.sourceKey)
          : await markCardLearnedWithGemAction(currentCard.sourceKey);
        if (!result.success) {
          rollbackGemSpend(reservation);
          rollbackOptimisticCardMutation(mutation);
          void Promise.all([refreshProfile(), loadCloudInventory()]).catch(() => undefined);
          showMessage(result.error?.trim() || t("inventory.error.operationFailed"), "error");
          return;
        }
        settleGemSpend(reservation);
        settleOptimisticCardMutation(mutation);
        void Promise.all([refreshProfile(), loadCloudInventory()]).catch(() => undefined);
      } catch (error) {
        rollbackGemSpend(reservation);
        rollbackOptimisticCardMutation(mutation);
        void Promise.all([refreshProfile(), loadCloudInventory()]).catch(() => undefined);
        showMessage(error instanceof Error && error.message.trim() ? error.message : t("inventory.error.operationFailed"), "error");
      } finally {
        setBusy(false);
      }
    })();
  }

  if (!mounted || !currentCard || !currentInventory || !palette || !backgroundShellEnd || !backgroundBackdrop || typeof document === "undefined") {
    return null;
  }

  const active = currentInventory.status === "active";
  const statusLabel = active ? t("inventory.status.active") : t("cards.learned");
  const statusBadgeSrc = active ? CARD_STATUS_BADGE_BY_STATUS.active : CARD_STATUS_BADGE_BY_STATUS.learned;
  const statusBackdrop = backgroundBackdrop;
  const blueBalance = user?.profile.blueGems ?? 0;
  const purpleBalance = user?.profile.purpleGems ?? 0;
  const removeCardCost = GEM_COSTS.removeCard.amount;
  const markLearnedCost = getMarkLearnedGemCost(currentCard.tier);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${currentCard.term} ${t("cards.centerTitle")}`}
      aria-hidden={!isOpen}
      inert={!isOpen}
      className={cn(
        "fixed inset-0 z-[70] isolate overflow-hidden text-white lg:hidden",
        introActive && phase !== "closing" && "rank-details-overlay-enter",
        phase === "closing" && "rank-details-overlay-exit pointer-events-none",
      )}
      data-rank-details-overlay
      data-rank-details-phase={phase}
      data-mobile-card-podium-overlay
      style={{
        backgroundColor: statusBackdrop,
        transition: isReviewMode ? "none" : "background-color 420ms cubic-bezier(0.22, 0.7, 0.24, 1)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        data-rank-details-gradient
      >
        {backgroundTransition ? (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(to top, ${backgroundTransition.from.shellEnd} 0%, ${backgroundTransition.from.backdrop} 70%, ${backgroundTransition.from.backdrop} 100%)`,
              }}
            />
            <div
              key={backgroundTransition.key}
              className="absolute inset-0"
              data-mobile-card-podium-gradient-incoming
              style={{
                backgroundImage: `linear-gradient(to top, ${backgroundTransition.to.shellEnd} 0%, ${backgroundTransition.to.backdrop} 70%, ${backgroundTransition.to.backdrop} 100%)`,
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to top, ${backgroundShellEnd} 0%, ${statusBackdrop} 70%, ${statusBackdrop} 100%)`,
            }}
          />
        )}
      </div>

      {!isReviewMode && !reviewIntro ? (
        <div
          className="absolute left-3 top-[max(0.5rem,env(safe-area-inset-top))] z-40"
          data-card-status-badge
          data-rank-details-ui="status"
        >
          <div className="flex translate-x-[21px] translate-y-[15px] flex-col items-center">
            <div
              key={`${currentCard.id}-${statusBadgeVisible ? "visible" : "hidden"}`}
              data-card-status-badge-content
              data-card-status-badge-visible={statusBadgeVisible ? "true" : "false"}
              data-card-status-badge-instant={isReviewMode ? "true" : "false"}
            >
              <Image
                src={statusBadgeSrc}
                alt=""
                aria-hidden="true"
                width={400}
                height={400}
                sizes="80px"
                className="size-20 shrink-0 object-contain"
              />
              <span
                className={cn(
                  "relative left-[10px] mt-[-2px] inline-block origin-top whitespace-nowrap text-[24px] font-semibold leading-none",
                  canUseSuperWater(locale) && "font-super-water",
                )}
                data-card-status-badge-text
                style={{
                  color: active ? "#ADF460" : "#059AF8",
                  display: "inline-block",
                  top: active ? "-11px" : undefined,
                  transform: "rotate(-12deg)",
                  transformOrigin: "top center",
                }}
              >
                {formatSuperWaterText(locale, statusLabel)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        data-mobile-back-close
        className="absolute right-3 top-[calc(max(0.5rem,env(safe-area-inset-top))+20px)] z-50 inline-flex size-11 items-center justify-center text-white transition-transform active:scale-90"
        data-rank-details-close
        data-rank-details-ui="close"
      >
        <X className="size-8 stroke-[4]" aria-hidden="true" />
      </button>

      <main
        className={cn(
          "absolute inset-x-0 bottom-[max(3.75rem,env(safe-area-inset-bottom)+3rem)] z-10 flex flex-col items-center px-4",
          isReviewMode ? "overflow-visible" : "overflow-y-auto",
        )}
        style={{ top: "calc(env(safe-area-inset-top) + 1.5rem)" }}
        onClick={isReviewMode ? handleReviewTap : undefined}
        onPointerDown={isReviewMode ? handleReviewPressStart : undefined}
        onPointerUp={isReviewMode ? handleReviewPressEnd : undefined}
        onPointerCancel={isReviewMode ? handleReviewPressEnd : undefined}
      >
        {isReviewMode && reviewIntro ? (
          <div
            key={`review-intro-${reviewSection}`}
            className="flex min-h-[28rem] w-full flex-1 shrink-0 flex-col items-center justify-center gap-4 text-center"
            data-card-review-intro
            data-card-review-intro-instant="true"
            data-card-review-pressed={isReviewPressed ? "true" : "false"}
            style={{
              transform: isReviewPressed ? "scale(0.94)" : "scale(1)",
              transition: "transform 150ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <Image
              src={statusBadgeSrc}
              alt=""
              aria-hidden="true"
              width={400}
              height={400}
              sizes="224px"
              className="size-56 shrink-0 object-contain"
            />
            <p className="font-super-water text-3xl font-semibold leading-none text-white">
              {formatSuperWaterText(locale, reviewSection === "active" ? t("cards.reviewToLearnIntro") : t("cards.reviewLearnedIntro"))}
            </p>
            <p className="mt-2 font-super-water text-2xl font-semibold leading-none text-white/90" data-card-review-hint>
              {formatSuperWaterText(locale, t("cards.tapToContinue"))}
            </p>
          </div>
        ) : (
          <>
        <div
          className={cn(
            "relative min-h-[24rem] w-full flex-1 shrink-0",
            isReviewMode ? "-translate-y-[30px]" : "-translate-y-[20px]",
          )}
        >
          <div
            ref={podiumTrackRef}
            className={cn(
              "absolute inset-0 z-10 flex w-full overflow-hidden overscroll-x-none select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              isReviewMode ? "touch-manipulation" : "touch-none",
              isDragging ? "cursor-grabbing" : "cursor-grab",
            )}
            data-mobile-card-podium-scroll
            data-mobile-card-podium-dragging={isDragging ? "true" : "false"}
            aria-label={t("cards.centerTitle")}
            tabIndex={0}
            onPointerDown={isReviewMode ? undefined : handlePointerDown}
            onPointerMove={isReviewMode ? undefined : handlePointerMove}
            onPointerUp={isReviewMode ? undefined : handlePointerUp}
            onPointerCancel={isReviewMode ? undefined : handlePointerCancel}
          >
            <div
              ref={podiumTrackContentRef}
              className="flex h-full shrink-0 will-change-transform"
              style={{ width: "900%", transform: "translate3d(-44.444444%, 0, 0)" }}
            >
              {PODIUM_SLOT_OFFSETS.map((slotOffset) => {
                const itemIndex = currentIndex + slotOffset;
                const item = items[itemIndex];
                if (!item) {
                  return <article key={`card-podium-slot-${slotOffset}`} className="relative h-full shrink-0" style={{ width: "11.111111%" }} />;
                }

                const slideCard = item.card;
                const slideInventory = item.inventory;
                const slideDefinition = getCardDefinition(slideCard, getStudyLocale(slideCard.language, locale));
                const isHighlighted = itemIndex === currentIndex;

                return (
                  <article
                    key={`card-podium-card-${slideCard.sourceKey}`}
                    className="relative flex h-full shrink-0 items-center justify-center"
                    data-rank-index={itemIndex}
                    data-highlighted={isHighlighted ? "true" : "false"}
                    style={{ width: "11.111111%" }}
                  >
                    <div className="relative flex h-full w-full items-center justify-center" data-card-podium-visual-motion>
                      <div className="relative flex h-full w-full items-center justify-center pb-12" data-rank-visual>
                        <div
                          className="relative top-[40px] z-10 w-[min(68vw,16rem)] max-w-full"
                          onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
                            if (isReviewMode) return;
                            if (itemIndex !== currentIndex || (event.target as HTMLElement).closest("button")) return;
                            if (didSwipeRef.current) {
                              didSwipeRef.current = false;
                              return;
                            }
                            setFace((current) => current === "front" ? "back" : "front");
                          }}
                        >
                          <div
                            className={cn(
                              "pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center justify-center gap-1",
                              isReviewMode ? "bottom-[calc(100%+30px)]" : "bottom-[calc(100%+20px)]",
                            )}
                            data-rank-details-ui="position"
                          >
                            <p className="text-4xl font-semibold leading-none text-white" aria-live="polite" data-rank-details-position>
                              {formatNumber(locale, itemIndex + 1)} / {formatNumber(locale, items.length)}
                            </p>
                            {isReviewMode ? (
                              <p className="mt-1 font-super-water text-2xl font-semibold leading-none text-white/90" data-card-added-at>
                              {formatAddedAt(locale, slideInventory.addedAt)}
                            </p>
                          ) : null}
                          </div>

                          <div
                            data-card-review-pressed={isReviewMode && isReviewPressed && isHighlighted ? "true" : "false"}
                            className="relative"
                            style={{
                              transform: isReviewMode && isReviewPressed && isHighlighted ? "scale(0.94)" : "scale(1)",
                              transition: "transform 150ms cubic-bezier(0.22, 1, 0.36, 1)",
                            }}
                          >
                            <VocabularyCardView
                              card={slideCard}
                              inventory={slideInventory}
                              owned
                              face={isHighlighted ? face : "front"}
                              initialFace="front"
                              flippable={false}
                              showActions={false}
                              frontFit
                              className="relative z-10 mx-auto aspect-[3/4] w-full max-w-[16rem]"
                            />

                            <Image
                              src={PODIUM_IMAGE_BY_TIER[slideCard.tier]}
                              alt=""
                              aria-hidden="true"
                              width={1600}
                              height={520}
                              sizes="352px"
                              draggable={false}
                              className="pointer-events-none absolute left-1/2 top-[calc(100%-40px)] z-0 h-auto w-[22rem] max-w-none -translate-x-1/2 select-none object-contain"
                            />

                            {slideDefinition ? <PodiumDefinitionText text={slideDefinition} cardId={slideCard.id} /> : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {canNavigate && !isReviewMode ? (
            <>
              <button
                type="button"
                onClick={() => move(-1)}
                disabled={currentIndex === 0}
                aria-label={t("cards.previousCard")}
                className="absolute left-0 top-1/2 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-transparent text-white transition disabled:opacity-20"
              >
                <span className="inline-flex" data-rank-details-ui="navigation-left">
                  <ChevronLeft className="card-podium-nav-arrow--left size-6 stroke-[4]" aria-hidden="true" />
                </span>
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                disabled={currentIndex === items.length - 1}
                aria-label={t("cards.nextCard")}
                className="absolute right-0 top-1/2 z-20 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-transparent text-white transition disabled:opacity-20"
              >
                <span className="inline-flex" data-rank-details-ui="navigation-right">
                  <ChevronRight className="card-podium-nav-arrow--right size-6 stroke-[4]" aria-hidden="true" />
                </span>
              </button>
            </>
          ) : null}

          {isReviewMode ? (
            <p
              className="pointer-events-none absolute inset-x-0 z-20 text-center text-4xl leading-none text-white font-super-water"
              style={{ top: "calc(50% + min(45.333vw, 10.6667rem) + 120px)" }}
              data-card-review-hint
            >
              {formatSuperWaterText(locale, t("cards.tapToContinue"))}
            </p>
          ) : null}
        </div>

        {!isReviewMode ? (
          <div
            className="fixed inset-x-4 z-30 flex flex-col"
            style={{ bottom: "max(10px, calc(env(safe-area-inset-bottom) + 10px))" }}
            data-card-supporting-content
            data-rank-details-ui="supporting"
          >
            <div className="flex w-full items-center gap-2">
              <CardGrammarDetailsButton
                onClick={() => setGrammarDetailsOpen(true)}
                showIcon={false}
                className="h-[46px] min-w-0 flex-1 justify-center border-transparent bg-white text-base leading-none hover:bg-white/90"
                style={{
                  color: backgroundShellEnd,
                  transition: "color 420ms cubic-bezier(0.22, 0.7, 0.24, 1)",
                }}
              />
              <button
                type="button"
                onClick={handleAskClick}
                aria-label={`${currentCard.term} ${t("cards.ask")}`}
                className="inline-flex size-[46px] shrink-0 items-center justify-center rounded-full bg-white transition-colors hover:bg-white/90"
                style={{
                  color: backgroundShellEnd,
                  transition: "color 420ms cubic-bezier(0.22, 0.7, 0.24, 1)",
                }}
              >
                <MessageCircleQuestion className="size-5" aria-hidden="true" />
              </button>
            </div>

            {active ? (
              <div className="flex w-full justify-center gap-2 pt-2" data-card-gem-actions data-rank-details-ui="actions">
                <GemCardAction type="blue" cost={removeCardCost} disabled={!user || blueBalance < removeCardCost || busy} label={t("gems.removeCard")} onClick={() => requestGemAction("blue")} />
                <GemCardAction type="purple" cost={markLearnedCost} disabled={!user || purpleBalance < markLearnedCost || busy} label={t("gems.markLearned")} onClick={() => requestGemAction("purple")} />
              </div>
            ) : null}
          </div>
        ) : null}
          </>
        )}
      </main>

      {confirmation ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-5" role="alertdialog" aria-modal="true">
          <div className="w-full max-w-xs rounded-3xl bg-background-card p-5 text-center text-foreground shadow-lg">
            <p className="text-base font-semibold">{t(confirmation === "blue" ? "gems.confirmRemove" : "gems.confirmLearned")}</p>
            <div className="mt-4 flex gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirmation(null)} className="min-h-11 flex-1 rounded-full bg-black px-3 py-2 text-sm font-bold text-[var(--brand)]">{t("gems.cancel")}</button>
              <button type="button" disabled={busy} onClick={() => void confirmGemAction()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full bg-[var(--brand)] px-3 py-2 text-sm font-bold text-[var(--brand-foreground)]">
                {t("gems.confirm")} {confirmation === "blue" ? removeCardCost : markLearnedCost}<Image src={GEM_ASSETS[confirmation]} alt="" width={20} height={20} className="size-5 object-contain" />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <CardGrammarDetailsOverlay
        card={currentCard}
        open={grammarDetailsOpen}
        nativeLocale={locale}
        onClose={() => setGrammarDetailsOpen(false)}
      />
    </div>,
    document.body,
  );
}

const PODIUM_DEFINITION_BASE_FONT_SIZE = 14;
const PODIUM_DEFINITION_MIN_FONT_SIZE = 10;
const PODIUM_DEFINITION_MAX_FONT_SIZE = 24;
const PODIUM_DEFINITION_MAX_LENGTH = 300;

function PodiumDefinitionText({ text, cardId }: { text: string; cardId: string }) {
  const pathId = `podium-definition-curve-${cardId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const textRef = useRef<SVGTextElement | null>(null);
  const [fontSize, setFontSize] = useState(PODIUM_DEFINITION_BASE_FONT_SIZE);
  const [compressToLimit, setCompressToLimit] = useState(false);

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const measuredLength = textRef.current?.getComputedTextLength() ?? 0;
      const naturalLength = Number.isFinite(measuredLength) && measuredLength > 0
        ? measuredLength
        : Math.max(text.length * 7.5, 1);
      const nextFontSize = Math.min(
        PODIUM_DEFINITION_MAX_FONT_SIZE,
        Math.max(
          PODIUM_DEFINITION_MIN_FONT_SIZE,
          PODIUM_DEFINITION_BASE_FONT_SIZE * PODIUM_DEFINITION_MAX_LENGTH / naturalLength,
        ),
      );

      setFontSize(nextFontSize);
      setCompressToLimit(naturalLength > PODIUM_DEFINITION_MAX_LENGTH);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [text]);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[calc(100%+24.5px)] z-20 h-14 w-[22rem] max-w-none -translate-x-1/2"
    >
      <div className="size-full" data-rank-details-ui="definition">
        <svg aria-label={text} className="size-full overflow-visible" role="img" viewBox="0 0 352 60">
          <defs>
            <path id={pathId} d="M 18 7 Q 176 39 334 7" />
          </defs>
          <text
            ref={textRef}
            fill="white"
            fontSize={fontSize}
            fontWeight="600"
            textAnchor="middle"
            textLength={compressToLimit ? PODIUM_DEFINITION_MAX_LENGTH : undefined}
            lengthAdjust={compressToLimit ? "spacingAndGlyphs" : undefined}
          >
            <textPath href={`#${pathId}`} startOffset="50%">
              {text}
            </textPath>
          </text>
        </svg>
      </div>
    </div>
  );
}

function GemCardAction({ type, cost, disabled, label, onClick }: { type: GemType; cost: number; disabled: boolean; label: string; onClick: () => void }) {
  const { locale } = useLocale();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-[55px] min-w-0 flex-1 items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        canUseSuperWater(locale) && "font-super-water",
        type === "blue" ? "bg-[#268cff]" : "bg-[#9b31dc]",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{formatSuperWaterText(locale, label)}</span>
      <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap" aria-label={String(cost)}>
        <span>{formatSuperWaterText(locale, String(cost))}</span>
        <Image src={GEM_ASSETS[type]} alt="" width={20} height={20} className="size-5 object-contain" />
      </span>
    </button>
  );
}
