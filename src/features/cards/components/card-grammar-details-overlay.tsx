"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpenText, Loader2, X } from "lucide-react";
import { getCardExampleTranslation, getPrimaryCardTranslation, getStudyLocale } from "@/features/cards/card-localization";
import { buildPreviewVocabularyCard } from "@/features/cards/custom-card-preview";
import type { GrammarSection } from "@/features/cards/card-grammar";
import type { GeneratedCardResponse } from "@/features/cards/create-card-schema";
import { cardGrammarResponseSchema } from "@/features/cards/card-grammar";
import { useAppMessage } from "@/components/app-message-provider";
import { useLocale, useT } from "@/i18n/locale-provider";
import { getCardDefinition } from "@/data/card-definitions";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { LocaleCode, Tier, VocabularyCard } from "@/types/domain";

const POLL_INTERVAL_MS = 900;
const POLL_TIMEOUT_MS = 30_000;
const OVERLAY_TRANSITION_MS = 840;

const TIER_COLORS: Record<Tier, string> = {
  A1: "var(--tier-a1)",
  A2: "var(--tier-a2)",
  B1: "var(--tier-b1)",
  B2: "var(--tier-b2)",
  C1: "var(--tier-c1)",
};

function logGrammarTrace(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("events" in payload)) return;

  const events = (payload as { events?: unknown }).events;
  if (!Array.isArray(events)) return;

  for (const event of events) {
    if (typeof event === "string") {
      console.info(`[Grammar Guide] ${event}`);
    }
  }
}

export function CardGrammarDetailsButton({
  onClick,
  className,
  disabled = false,
  showIcon = true,
}: {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  showIcon?: boolean;
}) {
  const { locale } = useLocale();
  const t = useT();
  const label = t("cards.grammarDetails");

  return (
    <button
      type="button"
      data-card-grammar-details-button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/25 bg-black/55 px-3 text-xs font-semibold text-white shadow-sm backdrop-blur-sm transition-[background-color,transform] duration-300 hover:bg-black/75 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        canUseSuperWater(locale) && "font-super-water",
        className,
      )}
    >
      {showIcon ? <BookOpenText className="size-4 shrink-0" aria-hidden="true" /> : null}
      <span>{formatSuperWaterText(locale, label)}</span>
    </button>
  );
}

export function CardGrammarDetailsOverlay({
  card,
  open,
  nativeLocale,
  previewPayload = null,
  tutorialLayer,
  onClose,
}: {
  card: VocabularyCard | null;
  open: boolean;
  nativeLocale: LocaleCode;
  previewPayload?: GeneratedCardResponse | null;
  tutorialLayer?: string;
  onClose: () => void;
}) {
  const t = useT();
  const { showMessage } = useAppMessage();
  const [mounted, setMounted] = useState(false);
  const [rendered, setRendered] = useState(open);
  const [entered, setEntered] = useState(false);
  const [grammarSections, setGrammarSections] = useState<GrammarSection[]>([]);
  const [grammarLoading, setGrammarLoading] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const effectiveCard = useMemo(
    () => card ?? (previewPayload ? buildPreviewVocabularyCard(previewPayload) : null),
    [card, previewPayload],
  );

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open && effectiveCard) {
      setRendered(true);
      let enteredFrame: number | null = null;
      const frame = window.requestAnimationFrame(() => {
        enteredFrame = window.requestAnimationFrame(() => setEntered(true));
      });
      return () => {
        window.cancelAnimationFrame(frame);
        if (enteredFrame !== null) window.cancelAnimationFrame(enteredFrame);
      };
    }

    setEntered(false);
    closeTimerRef.current = window.setTimeout(() => setRendered(false), OVERLAY_TRANSITION_MS);
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, [effectiveCard, open]);

  useEffect(() => {
    if (!open || !effectiveCard) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [effectiveCard, open]);

  useEffect(() => {
    if (!open || !effectiveCard) return;

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const startedAt = Date.now();
    let timer: number | null = null;
    let cancelled = false;

    setGrammarSections([]);
    setGrammarLoading(true);

    const requestGrammar = async (poll: boolean): Promise<void> => {
      if (cancelled) return;

      const body = previewPayload
        ? { preview: previewPayload, nativeLocale, poll }
        : { sourceKey: effectiveCard.sourceKey, nativeLocale, poll };

      try {
        console.info("[Grammar Guide] İstemci isteği gönderiliyor.", {
          term: effectiveCard.term,
          nativeLocale,
          poll,
        });

        const response = await fetch("/api/cards/grammar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const payload: unknown = await response.json().catch(() => null);
        logGrammarTrace(payload);

        if (!response.ok) {
          const errorCode = payload && typeof payload === "object" && "errorCode" in payload
            ? String((payload as { errorCode?: unknown }).errorCode ?? "grammar_request_failed")
            : "grammar_request_failed";
          console.error("[Grammar Guide] API isteği başarısız oldu.", {
            status: response.status,
            errorCode,
          });
          throw new Error(errorCode);
        }

        const parsed = cardGrammarResponseSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("[Grammar Guide] API geçersiz bir Grammar Guide yanıtı döndürdü.", parsed.error.flatten());
          throw new Error("invalid_grammar_response");
        }

        console.info(`[Grammar Guide] API yanıtı alındı: ${parsed.data.status}.`);
        if (cancelled || requestId !== requestIdRef.current) return;

        if (parsed.data.status === "ready") {
          console.info("[Grammar Guide] Grammar Guide arayüzde gösterilmeye hazır.");
          setGrammarSections(parsed.data.sections);
          setGrammarLoading(false);
          return;
        }

        if (parsed.data.status === "failed") {
          console.error("[Grammar Guide] Grammar Guide üretimi başarısız sonuçlandı.");
          setGrammarLoading(false);
          showMessage(t("cards.grammarUnavailable"), "error");
          return;
        }

        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          setGrammarLoading(false);
          showMessage(t("cards.grammarUnavailable"), "error");
          return;
        }

        timer = window.setTimeout(() => void requestGrammar(true), POLL_INTERVAL_MS);
        console.info("[Grammar Guide] Üretim devam ediyor; Supabase durumu yeniden kontrol edilecek.");
      } catch (error) {
        if (cancelled || requestId !== requestIdRef.current || (error instanceof DOMException && error.name === "AbortError")) return;
        console.error("[Grammar Guide] İstemci tarafında Grammar Guide yüklenirken hata alındı.", error);
        setGrammarLoading(false);
        showMessage(t("cards.grammarUnavailable"), "error");
      }
    };

    void requestGrammar(false);

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [effectiveCard, nativeLocale, open, previewPayload, showMessage, t]);

  if (!mounted || !rendered || !effectiveCard) return null;

  const tierColor = TIER_COLORS[effectiveCard.tier];
  const infoBackground = tierColor;
  const translation = getPrimaryCardTranslation(effectiveCard, nativeLocale);
  const definition = getCardDefinition(effectiveCard, getStudyLocale(effectiveCard.language, nativeLocale));
  const examples = effectiveCard.examples ?? [];

  return createPortal(
    <div
      data-card-grammar-details-overlay
      data-tutorial-layer-portal={tutorialLayer}
      role="dialog"
      aria-modal="true"
      aria-label={t("cards.grammarDetails")}
      className={cn(
        "fixed inset-0 z-[1400] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-transparent px-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        open ? "card-grammar-details-overlay-enter" : "card-grammar-details-overlay-exit",
        !entered && "pointer-events-none",
      )}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      <div className="flex h-full min-h-0 w-full max-w-none flex-col text-white" onPointerDown={(event) => event.stopPropagation()}>
        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,3fr)_minmax(0,1fr)] gap-0">
          <section
            data-card-grammar-details-info
            data-card-grammar-details-panel="top"
            className="relative shrink-0 overflow-hidden rounded-none border border-[#3d3d3d] px-4 py-5 text-center"
            style={{ backgroundColor: infoBackground }}
          >
            <button
              type="button"
              data-card-grammar-details-close
              onClick={onClose}
              aria-label={t("cards.closeGrammarDetails")}
              className="absolute right-3 top-3 z-10 inline-flex size-12 items-center justify-center border-0 bg-transparent p-0 text-white shadow-none outline-none transition-transform duration-300 hover:bg-transparent focus-visible:outline-none active:scale-95"
            >
              <X className="size-7" strokeWidth={3.5} aria-hidden="true" />
            </button>
            <p className="break-words text-4xl font-semibold leading-tight text-white">{effectiveCard.term}</p>
            <p className="mt-1 break-words text-2xl leading-tight text-[#f0f0f0]">{translation}</p>
            {definition ? <p className="mx-auto mt-4 max-w-2xl break-words text-lg leading-7 text-[#f0f0f0]">{definition}</p> : null}
          </section>

          <ScrollableSection
            label={t("cards.grammar")}
            dataAttribute="data-card-grammar-details-grammar"
            animationPanel="middle"
          >
            {grammarLoading ? (
              <div className="flex min-h-24 flex-1 items-center justify-center text-[#d0d0d0]" role="status" aria-label={t("cards.grammarLoading")}>
                <Loader2 className="size-[70px] animate-spin" aria-hidden="true" />
              </div>
            ) : grammarSections.length > 0 ? (
              <div className="space-y-5">
                {grammarSections.map((section, sectionIndex) => (
                  <section key={`${section.title}-${sectionIndex}`} className="space-y-2">
                    <h4 className="text-lg font-semibold leading-7 text-white">{section.title}</h4>
                    <ul className="list-disc space-y-1.5 pl-5">
                      {section.items.map((item, index) => (
                        <li key={`${section.title}-${index}`} className="whitespace-pre-wrap break-words text-lg leading-8 text-white">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : null}
          </ScrollableSection>

          <ScrollableSection
            label={t("cards.exampleSentences")}
            dataAttribute="data-card-grammar-details-examples"
            animationPanel="bottom"
            className="bg-black"
          >
            {examples.length > 0 ? (
              <div className="space-y-4">
                {examples.map((example) => (
                  <div key={example.id} className="space-y-1.5 border-b border-[#3d3d3d] pb-3 last:border-b-0 last:pb-0">
                    <p className="break-words text-lg leading-8 text-white">{example.sentence}</p>
                    <p className="break-words text-lg leading-8 text-[#d0d0d0]">{getCardExampleTranslation(example, nativeLocale)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-lg text-[#d0d0d0]">{t("cards.noExampleSentences")}</p>
            )}
          </ScrollableSection>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ScrollableSection({
  label,
  dataAttribute,
  animationPanel,
  className,
  children,
}: {
  label: string;
  dataAttribute: string;
  animationPanel: "middle" | "bottom";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      {...{ [dataAttribute]: true }}
      data-card-grammar-details-panel={animationPanel}
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-none border border-[#3d3d3d] bg-[#202020] px-4 py-3", className)}
    >
      <h3 className="shrink-0 text-2xl font-super-water text-white">{label}</h3>
      <div className="mt-2 flex min-h-0 flex-1 flex-col touch-pan-y overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">{children}</div>
    </section>
  );
}
