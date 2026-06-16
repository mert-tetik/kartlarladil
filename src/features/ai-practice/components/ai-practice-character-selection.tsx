"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { LanguageFlag } from "@/components/language-flag";
import { Badge } from "@/components/ui/badge";
import { getAiPracticeCharacters, getCharacterName } from "@/features/ai-practice/ai-practice-data";
import { getLanguageDisplayName } from "@/i18n/labels";

import type { LanguageCode, LocaleCode, Tier } from "@/types/domain";

export function AiPracticeCharacterSelection({
  language,
  locale,
  tier,
}: {
  language: LanguageCode;
  locale: LocaleCode;
  tier: Tier;
}) {
  const languageName = getLanguageDisplayName(language, locale);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {getAiPracticeCharacters().map((character) => {
        const characterName = getCharacterName(character, language);

        return (
          <Link
            key={character.id}
            href={`/ai-practice/${language}/${character.id}?tier=${tier}`}
            className="group overflow-hidden rounded-lg border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          >
            <div className="relative aspect-square overflow-hidden bg-slate-100">
              <Image
                src={character.imageSrc}
                alt={characterName}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-slate-950">{characterName}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                    {character.summaryByLocale[locale]}
                  </p>
                </div>
                <ArrowRight
                  className="mt-1 size-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-950"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <Badge className="gap-1.5">
                  <LanguageFlag code={language} className="size-3.5" />
                  {languageName}
                </Badge>
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  Chat
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
