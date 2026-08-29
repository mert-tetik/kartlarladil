"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { LANGUAGES } from "@/data/languages";
import {
  readLandingCardLanguage,
  writeLandingCardLanguage,
} from "@/app/components/landing-card-language";
import { LanguageFlag, LanguageFlagWithBrandOutline } from "@/components/language-flag";
import { Button } from "@/components/ui/button";
import { updateLanguagePreferenceAction } from "@/features/auth/actions";
import { UpgradeDialog, type UpgradeDialogErrorCode } from "@/features/subscriptions/components/upgrade-dialog";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import type { LocaleCode } from "@/types/domain";

export function shouldBlockLocaleChange(pathname: string, currentLocale: LocaleCode, nextLocale: LocaleCode) {
  return pathname === "/learn" && currentLocale !== nextLocale;
}

export function LocaleSwitcher({ navbar = false }: { navbar?: boolean }) {
  const { locale, setLocale } = useLocale();
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dialogError, setDialogError] = useState<UpgradeDialogErrorCode | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const buttonId = useId();
  const listboxId = useId();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !mobileMenuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", closeOnOutsideClick);

    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  function selectLocale(nextLocale: LocaleCode) {
    if (shouldBlockLocaleChange(pathname, locale, nextLocale)) {
      setDialogError("learn_locale_locked");
      setOpen(false);
      return;
    }

    const cardLanguage = readLandingCardLanguage();
    if (cardLanguage && cardLanguage === nextLocale) {
      setDialogError("language_match_not_allowed");
      setOpen(false);
      return;
    }

    setLocale(nextLocale);
    void updateLanguagePreferenceAction({
      field: "preferred_ui_locale",
      value: nextLocale,
    }).catch(() => undefined);
    setOpen(false);
  }

  return (
    <>
      <div ref={rootRef} className="relative">
        <Button
          id={buttonId}
          type="button"
          variant="secondary"
          size="sm"
          aria-label={t("locale.change")}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "h-9 gap-3 px-2",
            navbar &&
              "border-transparent bg-transparent text-white hover:bg-transparent hover:text-white lg:border-white/15 lg:bg-white/5 lg:hover:bg-white/10",
          )}
        >
          <LanguageFlag code={locale} className="size-6" imageClassName="scale-125" />
          {navbar ? (
            <span className="max-w-20 truncate text-xs font-semibold text-white">
              {getLanguageDisplayName(locale, locale)}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 text-foreground-muted transition-transform",
              navbar && "text-white/65",
              open && "rotate-180",
            )}
          />
        </Button>

        {navbar && mounted
          ? createPortal(
              <div
                ref={mobileMenuRef}
                data-locale-menu="mobile"
                id={`${listboxId}-mobile`}
                role="listbox"
                aria-labelledby={buttonId}
                aria-hidden={!open}
                inert={!open}
                className={cn(
                  "fixed inset-x-0 top-[var(--app-header-height)] z-[60] grid h-[calc(100dvh-var(--app-header-height))] max-h-[calc(100dvh-var(--app-header-height))] origin-top transform-gpu grid-rows-[minmax(0,1fr)_2.5rem] overflow-hidden rounded-b-2xl border-x-0 border-b border-t-0 border-border bg-background-card text-foreground transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,opacity] lg:hidden",
                  open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0",
                )}
              >
                <div className="grid min-h-0 grid-cols-3 content-start gap-x-2 gap-y-3 overflow-y-auto px-4 py-5">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t("quiz.exit")}
                    className="relative flex min-h-36 w-full flex-col items-center justify-start gap-1.5 border-0 bg-transparent px-1 pb-1 pt-2 text-center text-foreground transition-transform duration-200 active:scale-95"
                  >
                    <span className="relative inline-flex size-24 items-center justify-center text-white">
                      <X aria-hidden="true" className="size-24" strokeWidth={2.5} />
                    </span>
                    <span className="min-h-8 max-w-full px-1 text-[0.7rem] font-semibold leading-4 text-foreground">
                      {t("quiz.exit")}
                    </span>
                  </button>
                  {LANGUAGES.map((language) => {
                    const selected = language.code === locale;
                    const nextLocale = language.code as LocaleCode;

                    return (
                      <button
                        key={language.code}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => selectLocale(nextLocale)}
                        className="relative flex min-h-36 w-full flex-col items-center justify-start gap-1.5 border-0 bg-transparent px-1 pb-1 pt-2 text-center text-foreground transition-transform duration-200 active:scale-95"
                      >
                        <span className="relative inline-flex">
                          <LanguageFlagWithBrandOutline
                            code={language.code}
                            className="size-24"
                            imageClassName="scale-100"
                            outlineInset="-inset-1.5"
                            selected={selected}
                          />
                        </span>
                        <span
                          className={cn(
                            "min-h-8 max-w-full px-1 leading-4",
                            selected ? "text-base font-bold text-brand" : "text-[0.7rem] font-semibold text-foreground",
                          )}
                        >
                          {language.nativeName}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center border-t border-border" aria-hidden="true">
                  <span className="h-1 w-10 rounded-full bg-foreground-muted/40" />
                </div>
              </div>,
              document.body,
            )
          : null}

        {open ? (
          <div
            data-locale-menu="desktop"
            id={listboxId}
            role="listbox"
            aria-labelledby={buttonId}
            className={cn(
              "animate-menu-pop absolute right-0 top-[calc(100%+8px)] z-50 w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-border bg-background-card p-1 shadow-lg",
              navbar && "navbar-locale-top-sheet fixed left-1/2 right-auto top-[72px] flex w-64 max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col border-white/10 bg-black p-1 text-white shadow-sm max-lg:hidden",
            )}
          >
            <div className={cn(navbar && "max-lg:flex-1 max-lg:overflow-y-auto max-lg:p-3")}>
              {LANGUAGES.map((language) => {
                const selected = language.code === locale;
                const nextLocale = language.code as LocaleCode;

                return (
                  <button
                    key={language.code}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => selectLocale(nextLocale)}
                    className={cn(
                      "flex h-14 w-full cursor-pointer items-center justify-between rounded-md px-3 text-left text-sm transition-colors hover:bg-background",
                      selected && "bg-background-muted",
                      navbar && "lg:text-white lg:hover:bg-white/10",
                      navbar && selected && "lg:bg-white/10",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <LanguageFlagWithBrandOutline
                        code={language.code}
                        className="size-8"
                        imageClassName="scale-125"
                        outlineInset="-inset-0.5"
                        selected={selected}
                      />
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block truncate font-semibold text-foreground",
                            selected ? "text-base font-bold text-brand" : "text-sm",
                            navbar && !selected && "lg:text-white",
                          )}
                        >
                          {language.nativeName}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-xs text-foreground-muted",
                            selected ? "font-semibold text-brand/75" : null,
                            navbar && !selected && "lg:text-white/60",
                          )}
                        >
                          {getLanguageDisplayName(language.code, locale)}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {navbar ? (
              <div className="hidden h-10 shrink-0 items-center justify-center border-t border-border lg:hidden" aria-hidden="true">
                <span className="h-1 w-10 rounded-full bg-foreground-muted/40" />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <UpgradeDialog
        open={dialogError !== null}
        errorCode={dialogError}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDialogError(null);
          }
        }}
        onSwapLanguages={() => {
          const cardLanguage = readLandingCardLanguage();
          if (!cardLanguage) {
            return;
          }

          const previousLocale = locale;
          setLocale(cardLanguage);
          writeLandingCardLanguage(previousLocale);
          void updateLanguagePreferenceAction({
            field: "preferred_ui_locale",
            value: cardLanguage,
          }).catch(() => undefined);
          void updateLanguagePreferenceAction({
            field: "preferred_language_code",
            value: previousLocale,
          }).catch(() => undefined);
        }}
      />
    </>
  );
}
