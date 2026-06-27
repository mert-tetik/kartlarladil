"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LANGUAGES } from "@/data/languages";
import { LanguageFlag } from "@/components/language-flag";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { useIsClient } from "@/lib/use-is-client";
import { vibrate } from "@/lib/vibration";
import type { LanguageCode } from "@/types/domain";

interface LanguageOption {
  code: LanguageCode;
  count: number;
}

interface MobileLanguageBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  options: LanguageOption[];
  selectedLanguage: LanguageCode;
  onSelect: (language: LanguageCode) => void;
}

export function MobileLanguageBottomSheet({
  isOpen,
  onClose,
  options,
  selectedLanguage,
  onSelect,
}: MobileLanguageBottomSheetProps) {
  const { locale } = useLocale();
  const t = useT();
  const mounted = useIsClient();
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number | null>(null);
  const startDragYRef = useRef(0);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const visualDragY = isOpen ? Math.max(0, dragY) : 0;

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const sortedOptions = [...options].sort((a, b) => b.count - a.count);

  function handlePointerDown(event: React.PointerEvent) {
    startYRef.current = event.clientY;
    startDragYRef.current = dragY;
    setIsDragging(true);
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (startYRef.current === null || !isDragging) return;
    const delta = event.clientY - startYRef.current;
    if (delta < 0) {
      setDragY(delta / 3);
    } else {
      setDragY(delta);
    }
  }

  function handlePointerUp(event: React.PointerEvent) {
    if (startYRef.current === null) return;
    const delta = event.clientY - startYRef.current;
    const sheetHeight = sheetRef.current?.offsetHeight ?? 0;
    setIsDragging(false);
    startYRef.current = null;

    if (delta > sheetHeight * 0.35 || delta > 160) {
      onClose();
    } else {
      setDragY(0);
    }
  }

  function handleSelect(language: LanguageCode) {
    vibrate("tap");
    onSelect(language);
    onClose();
  }

  const content = (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-300 lg:hidden",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!isOpen}
      inert={!isOpen}
      role="dialog"
      aria-modal={isOpen}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        style={{
          transform: `translate3d(0, ${visualDragY}px, 0)`,
          transition: isDragging ? "none" : "transform 300ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className={cn(
          "relative flex max-h-[85dvh] flex-col rounded-t-2xl bg-background-card shadow-2xl",
          isDragging ? "cursor-grabbing" : "",
        )}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="flex shrink-0 cursor-grab flex-col items-center border-b border-border bg-background-card px-4 py-3 active:cursor-grabbing"
        >
          <div className="mb-3 h-1.5 w-12 rounded-full bg-foreground-muted/40" />
          <h2 className="w-full text-left text-base font-semibold text-foreground">
            {t("home.mobile.selectLanguage")}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {sortedOptions.length === 0 ? (
            <p className="py-8 text-center text-sm text-foreground-secondary">
              {t("quiz.noPracticeLanguagesDescription")}
            </p>
          ) : (
            <div className="grid gap-2">
              {sortedOptions.map((option) => {
                const language = LANGUAGES.find((item) => item.code === option.code);
                if (!language) return null;
                const selected = option.code === selectedLanguage;

                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => handleSelect(option.code)}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-3 text-left transition-colors",
                      selected
                        ? "border-foreground bg-background-muted"
                        : "border-border bg-background hover:bg-background-muted",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <LanguageFlag code={option.code} className="h-8 w-12" />
                      <span className="text-base font-semibold text-foreground">
                        {getLanguageDisplayName(option.code, locale)}
                      </span>
                    </span>
                    <span className="flex flex-col items-end">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                        {t("home.mobile.cardsLabel")}
                      </span>
                      <span className="text-xl font-bold text-foreground">
                        {option.count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
