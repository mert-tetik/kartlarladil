"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MessageCircle } from "lucide-react";
import { MobileLanguageBottomSheet } from "@/app/components/mobile-language-bottom-sheet";
import { LanguageFlag } from "@/components/language-flag";
import { LANGUAGES } from "@/data/languages";
import { getAiPracticeCharacters, getCharacterName } from "@/features/ai-practice/ai-practice-data";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import { vibrate } from "@/lib/vibration";

import type { LanguageCode, LocaleCode, Tier } from "@/types/domain";

export function AiPracticeCharacterSelection({
  language,
  locale: serverLocale,
  tier,
}: {
  language: LanguageCode;
  locale: LocaleCode;
  tier: Tier;
}) {
  const router = useRouter();
  const { locale: clientLocale } = useLocale();
  const t = useT();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(language);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const locale = clientLocale ?? serverLocale;
  const languageOptions = LANGUAGES.map((language) => ({ code: language.code, count: 0 }));

  function handleLanguageChange(code: LanguageCode) {
    setSelectedLanguage(code);
    navigateWithRouteTransition(() => router.replace(`/ai-practice/${code}/character?tier=${tier}`));
  }

  return (
    <div
      className="w-full overflow-y-auto rounded-lg border border-border bg-background p-3 lg:h-[480px] max-lg:flex-1 max-lg:min-h-0 max-lg:h-full max-lg:overscroll-contain max-lg:touch-pan-y max-lg:pb-4 max-sm:-mx-4 max-sm:w-[calc(100%+2rem)] max-sm:rounded-none max-sm:border-x-0"
      data-ai-practice-character-container
    >
      <div className="mb-4">
        <button
          data-ai-practice-language-button
          type="button"
          onClick={() => {
            vibrate("tap");
            setLanguageSheetOpen(true);
          }}
          className="flex w-full shrink-0 items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-1.5 text-left text-slate-950 transition-colors hover:bg-slate-100"
        >
          <span className="flex items-center gap-3">
            <LanguageFlag code={selectedLanguage} className="h-6 w-9" />
            <span className="text-base font-semibold text-slate-950">
              {getLanguageDisplayName(selectedLanguage, locale)}
            </span>
          </span>
          <span className="text-xs font-semibold text-slate-500">{t("home.mobile.cardLanguage")}</span>
        </button>
      </div>

      <MobileLanguageBottomSheet
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        options={languageOptions}
        selectedLanguage={selectedLanguage}
        onSelect={(code) => {
          setSelectedLanguage(code);
          handleLanguageChange(code);
        }}
        showBackdrop
        sheetClassName="max-h-[50dvh]"
        visualStyle="light"
        showCounts={false}
      />

      <div
        className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5"
        data-ai-practice-character-list
      >
        {getAiPracticeCharacters().map((character) => {
          const characterName = getCharacterName(character, selectedLanguage);

          return (
            <Link
              key={character.id}
              href={`/ai-practice/${selectedLanguage}?character=${character.id}`}
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
