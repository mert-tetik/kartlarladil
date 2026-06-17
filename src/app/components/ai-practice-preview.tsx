import Image from "next/image";
import Link from "next/link";
import { Coins } from "lucide-react";

import { buttonClassName } from "@/components/ui/button";
import {
  getAiPracticeCharacters,
  getCharacterName,
} from "@/features/ai-practice/ai-practice-data";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { LANGUAGE_CODES } from "@/data/languages";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { cn } from "@/lib/utils";
import type { LanguageCode } from "@/types/domain";

export async function AiPracticePreview() {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const characters = getAiPracticeCharacters();
  const user = await getCurrentAuthUser();

  const language: LanguageCode =
    user?.profile?.preferredLanguageCode &&
    LANGUAGE_CODES.includes(user.profile.preferredLanguageCode)
      ? user.profile.preferredLanguageCode
      : "en";

  function getCharacterHref(characterId: string) {
    const target = `/ai-practice/${language}/${characterId}`;

    if (!user) {
      return `/login?next=${encodeURIComponent(target)}`;
    }

    return target;
  }

  return (
    <section className="bg-white dark:bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-display text-4xl font-semibold text-slate-950 dark:text-white">
              {t("home.aiPractice.title")}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-foreground-secondary">
              {t("home.aiPractice.description")}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 font-bold text-amber-500 dark:text-white">
              <Coins className="size-5" aria-hidden="true" />
              {t("home.aiPractice.highlight")}
            </div>
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

        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
          {characters.map((character) => {
            const characterName = getCharacterName(character, locale as LanguageCode);

            return (
              <Link
                key={character.id}
                href={getCharacterHref(character.id)}
                className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 dark:border-border dark:bg-background-card dark:hover:border-border dark:hover:bg-background-muted dark:focus-visible:outline-white"
              >
                <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-background-muted">
                  <Image
                    src={character.imageSrc}
                    alt={characterName}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-4">
                  <h3 className="truncate text-base font-semibold text-slate-950 dark:text-white">
                    {characterName}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-foreground-secondary">
                    {character.summaryByLocale[locale]}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
