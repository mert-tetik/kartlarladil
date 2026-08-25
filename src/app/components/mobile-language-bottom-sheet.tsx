"use client";

import { LANGUAGES } from "@/data/languages";
import { LanguageFlag, LanguageFlagWithBrandOutline } from "@/components/language-flag";
import { MobileBottomSheetShell } from "@/components/mobile-bottom-sheet-shell";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
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
  allowAll?: boolean;
  isAllSelected?: boolean;
  onSelectAll?: () => void;
  allLabel?: string;
  showBackdrop?: boolean;
  sheetClassName?: string;
  visualStyle?: "default" | "light";
  optionStyle?: "default" | "navbar";
  showCounts?: boolean;
}

export function MobileLanguageBottomSheet({
  isOpen,
  onClose,
  options,
  selectedLanguage,
  onSelect,
  allowAll = false,
  isAllSelected = false,
  onSelectAll,
  allLabel,
  showBackdrop = true,
  sheetClassName,
  optionStyle = "default",
  showCounts = true,
}: MobileLanguageBottomSheetProps) {
  const { locale } = useLocale();
  const t = useT();
  const useNavbarOptionStyle = optionStyle === "navbar";
  const sortedOptions = [...options].sort((a, b) => b.count - a.count);

  function handleSelect(language: LanguageCode) {
    vibrate("tap");
    onSelect(language);
    onClose();
  }

  return (
    <MobileBottomSheetShell
      open={isOpen}
      onClose={onClose}
      title={t("home.mobile.selectLanguage")}
      panelLabel={t("home.mobile.selectLanguage")}
      panelClassName={cn("max-h-[85dvh]", sheetClassName)}
      showBackdrop={showBackdrop}
      visual={<LanguageFlag code={selectedLanguage} className="size-[3.25rem]" />}
      contentClassName="overflow-y-auto p-4"
    >
      <div className={cn("grid gap-2", useNavbarOptionStyle && "grid-cols-3 gap-x-2 gap-y-3")}>
        {allowAll ? (
          <button
            type="button"
            onClick={() => {
              vibrate("tap");
              onSelectAll?.();
              onClose();
            }}
            className={cn(
              "flex items-center justify-between rounded-xl border p-3 text-left transition-colors",
              isAllSelected
                ? "border-brand-foreground bg-brand-foreground/10"
                : "border-border bg-background hover:bg-background-muted",
            )}
          >
            <span className="text-base font-semibold text-brand-foreground">
              {allLabel ?? t("home.mobile.allTiers")}
            </span>
          </button>
        ) : null}
        {sortedOptions.length === 0 ? (
          <p className="py-8 text-center text-sm text-brand-foreground/75">
            {t("quiz.noPracticeLanguagesDescription")}
          </p>
        ) : (
          sortedOptions.map((option) => {
            const language = LANGUAGES.find((item) => item.code === option.code);
            if (!language) return null;
            const selected = option.code === selectedLanguage;

            return (
              <button
                key={option.code}
                type="button"
                onClick={() => handleSelect(option.code)}
                className={cn(
                  useNavbarOptionStyle
                    ? "relative flex min-h-36 w-full flex-col items-center justify-start gap-1.5 border-0 bg-transparent px-1 pb-1 pt-2 text-center transition-transform duration-200 active:scale-95"
                    : "flex items-center justify-between rounded-xl border p-3 text-left transition-colors",
                  selected
                    ? useNavbarOptionStyle
                      ? "text-brand-foreground"
                      : "border-brand-foreground bg-brand-foreground/10"
                    : useNavbarOptionStyle
                      ? "text-brand-foreground/80"
                      : "border-border bg-background hover:bg-background-muted",
                )}
              >
                {useNavbarOptionStyle ? (
                  <>
                    <span className="relative inline-flex size-24 items-center justify-center">
                      <LanguageFlagWithBrandOutline
                        code={option.code}
                        className="size-24"
                        imageClassName="scale-100"
                        outlineInset="-inset-1.5"
                        selected={selected}
                      />
                    </span>
                    <span
                      className={cn(
                        "min-h-8 max-w-full px-1 leading-4",
                        selected ? "text-base font-bold text-brand-foreground" : "text-[0.7rem] font-semibold",
                      )}
                    >
                      {language.nativeName}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-3">
                      <LanguageFlag code={option.code} className="h-8 w-12" />
                      <span className="text-base font-semibold text-brand-foreground">
                        {getLanguageDisplayName(option.code, locale)}
                      </span>
                    </span>
                    {showCounts ? (
                      <span className="flex flex-col items-end">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">
                          {t("home.mobile.cardsLabel")}
                        </span>
                        <span className="text-xl font-bold text-foreground">
                          {option.count}
                        </span>
                      </span>
                    ) : null}
                  </>
                )}
              </button>
            );
          })
        )}
      </div>
    </MobileBottomSheetShell>
  );
}
