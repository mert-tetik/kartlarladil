import { LANGUAGE_BY_CODE } from "@/data/languages";
import { cn } from "@/lib/utils";
import type { LanguageCode, LocaleCode } from "@/types/domain";

const FLAG_BACKGROUNDS: Record<string, string> = {
  tr: "linear-gradient(90deg, #e30a17 0 100%)",
  gb: "linear-gradient(90deg, #012169 0 100%)",
  de: "linear-gradient(180deg, #111827 0 33%, #dc2626 33% 66%, #facc15 66% 100%)",
  ru: "linear-gradient(180deg, #fff 0 33%, #2563eb 33% 66%, #dc2626 66% 100%)",
  fr: "linear-gradient(90deg, #1d4ed8 0 33%, #fff 33% 66%, #dc2626 66% 100%)",
  es: "linear-gradient(180deg, #c60b1e 0 25%, #ffc400 25% 75%, #c60b1e 75% 100%)",
  it: "linear-gradient(90deg, #15803d 0 33%, #fff 33% 66%, #dc2626 66% 100%)",
  pt: "linear-gradient(90deg, #15803d 0 42%, #dc2626 42% 100%)",
  nl: "linear-gradient(180deg, #ae1c28 0 33%, #fff 33% 66%, #21468b 66% 100%)",
  pl: "linear-gradient(180deg, #fff 0 50%, #dc143c 50% 100%)",
  sa: "linear-gradient(90deg, #166534 0 100%)",
  jp: "radial-gradient(circle at 50% 50%, #bc002d 0 32%, transparent 33%), linear-gradient(#fff 0 100%)",
  kr: "radial-gradient(circle at 50% 50%, #cd2e3a 0 26%, #0047a0 27% 52%, transparent 53%), linear-gradient(#fff 0 100%)",
  cn: "radial-gradient(circle at 28% 30%, #ffde00 0 10%, transparent 11%), linear-gradient(#de2910 0 100%)",
};

export function LanguageFlag({
  code,
  className,
}: {
  code: LanguageCode | LocaleCode;
  className?: string;
}) {
  const language = LANGUAGE_BY_CODE[code];

  return (
    <span
      role="img"
      aria-label={language.nativeName}
      className={cn("inline-block h-3.5 w-5 shrink-0 overflow-hidden rounded-[3px] border border-slate-900/10 bg-white", className)}
      style={{ backgroundImage: FLAG_BACKGROUNDS[language.flagCode] }}
    />
  );
}
