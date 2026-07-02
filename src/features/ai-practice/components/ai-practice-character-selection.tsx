"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MessageCircle } from "lucide-react";
import { InlineLanguagePicker } from "@/components/inline-language-picker";
import { getAiPracticeCharacters, getCharacterName } from "@/features/ai-practice/ai-practice-data";

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
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(language);

  function handleLanguageChange(code: LanguageCode) {
    setSelectedLanguage(code);
    router.replace(`/ai-practice/${code}/character?tier=${tier}`);
  }

  return (
    <div className="h-[480px] w-full overflow-y-auto rounded-lg border border-border bg-background p-3 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:rounded-none max-sm:border-x-0">
      <div className="mb-4">
        <InlineLanguagePicker value={selectedLanguage} onChange={handleLanguageChange} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {getAiPracticeCharacters().map((character) => {
          const characterName = getCharacterName(character, selectedLanguage);

          return (
            <Link
              key={character.id}
              href={`/ai-practice/${selectedLanguage}/${character.id}?tier=${tier}`}
              className="group overflow-hidden rounded-lg border border-border bg-background-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <div className="relative aspect-square overflow-hidden bg-background-muted">
                <Image
                  src={character.imageSrc}
                  alt={characterName}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-foreground">{characterName}</h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-foreground-secondary">
                      {character.summaryByLocale[locale]}
                    </p>
                  </div>
                  <ArrowRight
                    className="mt-1 size-4 shrink-0 text-foreground-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <span className="flex items-center gap-1 text-xs font-semibold text-foreground-muted">
                    <MessageCircle className="size-3.5" aria-hidden="true" />
                    Chat
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
