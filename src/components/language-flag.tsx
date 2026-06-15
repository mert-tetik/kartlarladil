import Image from "next/image";

import { LANGUAGE_BY_CODE } from "@/data/languages";
import { cn } from "@/lib/utils";
import type { LanguageCode, LocaleCode } from "@/types/domain";

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
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-[3px] border border-slate-900/10 bg-white",
        className,
      )}
    >
      <Image
        src={`/flags/4x3/${language.flagCode}.svg`}
        alt={language.nativeName}
        fill
        unoptimized
        className="object-cover"
        sizes="36px"
      />
    </span>
  );
}
