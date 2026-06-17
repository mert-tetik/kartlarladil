import Link from "next/link";
import { LanguageFlag } from "@/components/language-flag";
import { LANGUAGES } from "@/data/languages";
import { getLanguageDisplayName } from "@/i18n/labels";
import type { LocaleCode } from "@/types/domain";

export function AiPracticeLanguageSelection({ locale }: { locale: LocaleCode }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {LANGUAGES.map((language) => (
        <Link
          key={language.code}
          href={`/ai-practice/${language.code}`}
          className="group flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-background-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <LanguageFlag code={language.code} className="h-10 w-14" />
          <span className="text-center text-sm font-semibold text-foreground">
            {getLanguageDisplayName(language.code, locale)}
          </span>
        </Link>
      ))}
    </div>
  );
}
