import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { LanguageFlag } from "@/components/language-flag";
import { buttonClassName } from "@/components/ui/button";
import { LANGUAGES } from "@/data/languages";
import { getLanguageDisplayName } from "@/i18n/labels";
import type { LocaleCode } from "@/types/domain";

export function AiPracticeLanguageSelection({ locale }: { locale: LocaleCode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {LANGUAGES.map((language) => (
        <Link
          key={language.code}
          href={`/ai-practice/${language.code}`}
          className="group flex min-h-32 items-start justify-between rounded-lg border border-slate-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        >
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-950">
              <LanguageFlag code={language.code} />
              {getLanguageDisplayName(language.code, locale)}
            </span>
            <span className="mt-2 block text-sm text-slate-500">{language.nativeName}</span>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MessageCircle className="size-4" aria-hidden="true" />
              <span>AI</span>
            </span>
          </span>
          <ArrowRight
            className="mt-1 size-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-slate-950"
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  );
}

export function AiPracticeBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={buttonClassName("secondary", "sm")}>
      {label}
    </Link>
  );
}
