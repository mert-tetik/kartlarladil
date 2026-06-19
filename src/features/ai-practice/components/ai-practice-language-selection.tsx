import Link from "next/link";
import { LanguageFlag } from "@/components/language-flag";
import { LANGUAGES } from "@/data/languages";
import { getLanguageDisplayName } from "@/i18n/labels";
import type { LocaleCode } from "@/types/domain";

export function AiPracticeLanguageSelection({ locale }: { locale: LocaleCode }) {
  return (
    <div className="h-[320px] overflow-y-auto rounded-md border border-border bg-background p-2 max-sm:h-[280px]">
      <div className="grid grid-cols-1 gap-2">
        {LANGUAGES.map((language) => (
          <Link
            key={language.code}
            href={`/ai-practice/${language.code}`}
            className="group flex cursor-pointer items-center justify-between rounded-md border border-border bg-background-card p-3 transition-colors hover:bg-background-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
              <LanguageFlag code={language.code} />
              <span className="truncate">{getLanguageDisplayName(language.code, locale)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
