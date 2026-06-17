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
        "relative inline-block h-4 w-6 shrink-0 overflow-hidden rounded-[3px] border border-foreground/10 bg-background-card",
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
