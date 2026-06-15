import Image from "next/image";
import Link from "next/link";
import { Bot } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import {
  getAiPracticeCharacters,
  getCharacterName,
} from "@/features/ai-practice/ai-practice-data";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";

export async function AiPracticePreview() {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const characters = getAiPracticeCharacters();

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex size-12 items-center justify-center rounded-md bg-slate-950 text-white">
              <Bot className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-5 font-display text-4xl font-semibold text-slate-950">
              {t("home.aiPractice.title")}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              {t("home.aiPractice.description")}
            </p>
          </div>
          <Link
            href="/ai-practice"
            className={cn(
              buttonClassName("primary", "lg"),
              "w-full justify-center lg:w-auto",
            )}
          >
            {t("home.aiPractice.cta")}
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {characters.map((character) => {
            const characterName = getCharacterName(character, locale as LanguageCode);

            return (
              <div
                key={character.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="relative aspect-square overflow-hidden bg-slate-100">
                  <Image
                    src={character.imageSrc}
                    alt={characterName}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="truncate text-base font-semibold text-slate-950">
                    {characterName}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                    {character.summaryByLocale[locale]}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
