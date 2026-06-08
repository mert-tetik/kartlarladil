"use client";

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { BookOpenText, X } from "lucide-react";
import { LANGUAGE_NAMES } from "@/data/languages";
import { TIER_LABELS, TIER_STYLES } from "@/data/tiers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VocabularyCard } from "@/types/domain";

export function CardDetailsDialog({
  card,
  open,
  onOpenChange,
}: {
  card: VocabularyCard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const style = TIER_STYLES[card.tier];

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onOpenChange, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-0 sm:items-center sm:justify-center sm:p-6"
      onMouseDown={() => onOpenChange(false)}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="max-h-[92vh] w-full overflow-hidden rounded-t-lg border border-slate-200 bg-white shadow-sm sm:max-w-4xl sm:rounded-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={cn("border-b p-5", style.surface, style.border)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn("border-transparent bg-white/80", style.text)}>
                  {card.tier} · {TIER_LABELS[card.tier]}
                </Badge>
                <Badge className="border-transparent bg-white/80 text-slate-700">
                  {LANGUAGE_NAMES[card.language]}
                </Badge>
                <Badge className="border-transparent bg-white/80 text-slate-700">{card.partOfSpeech}</Badge>
              </div>
              <h2 id={titleId} className="mt-4 font-display text-3xl font-semibold leading-tight text-slate-950">
                {card.term} detayları
              </h2>
              <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-700">
                {card.translation} · {card.pronunciation}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Detayları kapat"
              onClick={() => onOpenChange(false)}
              className="shrink-0 bg-white/80"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="max-h-[calc(92vh-132px)] overflow-y-auto p-5">
          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <section className="flex flex-col gap-3" aria-labelledby={`${titleId}-examples`}>
              <div className="flex items-center gap-2">
                <BookOpenText className="size-5 text-slate-700" aria-hidden="true" />
                <h3 id={`${titleId}-examples`} className="text-base font-semibold text-slate-950">
                  5 örnek kullanım
                </h3>
              </div>
              <div className="flex flex-col gap-3">
                {card.examples.map((example) => (
                  <article key={example.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <Badge className="border-transparent bg-white text-slate-700">{example.label}</Badge>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-950">{example.sentence}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{example.translation}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-4" aria-labelledby={`${titleId}-grammar`}>
              <div>
                <h3 id={`${titleId}-grammar`} className="text-base font-semibold text-slate-950">
                  Gramer anlatımı
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.grammar.summary}</p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-slate-950">Kurallar</h4>
                <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-6 text-slate-600">
                  {card.grammar.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-slate-950">Notlar</h4>
                <div className="mt-3 flex flex-col gap-2 text-sm leading-6 text-slate-600">
                  {card.grammar.details.map((detail) => (
                    <p key={detail}>{detail}</p>
                  ))}
                </div>
              </div>

              {card.grammar.tables?.map((table) => (
                <div key={table.title} className="rounded-lg border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-950">{table.title}</h4>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[360px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          {table.columns.map((column) => (
                            <th key={column} scope="col" className="py-2 pr-4 font-semibold">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row) => (
                          <tr key={row.join("-")} className="border-b border-slate-100 last:border-0">
                            {row.map((cell) => (
                              <td key={cell} className="py-2 pr-4 text-slate-700">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
