import Image from "next/image";
import type { CSSProperties } from "react";

import { LANGUAGE_BY_CODE } from "@/data/languages";
import { cn } from "@/lib/utils";
import type { LanguageCode, LocaleCode } from "@/types/domain";

export const BRAND_FLAG_FILTER = "brightness(0) saturate(100%) invert(49%) sepia(92%) saturate(3236%) hue-rotate(2deg) brightness(101%) contrast(101%)";

export function LanguageFlag({
  code,
  className,
  imageClassName,
  imageStyle,
}: {
  code: LanguageCode | LocaleCode;
  className?: string;
  imageClassName?: string;
  imageStyle?: CSSProperties;
}) {
  const language = LANGUAGE_BY_CODE[code];

  return (
    <span
      className={cn(
        "relative inline-block h-5 w-5 shrink-0 overflow-visible rounded-full",
        className,
      )}
    >
      <Image
        src={`/flags/language/${language.code}.png`}
        alt={language.nativeName}
        fill
        unoptimized
        className={cn("object-contain", imageClassName ?? "scale-[1.45]")}
        style={imageStyle}
        sizes="40px"
      />
    </span>
  );
}

export function LanguageFlagWithBrandOutline({
  code,
  selected,
  className,
  imageClassName,
  outlineInset,
}: {
  code: LanguageCode | LocaleCode;
  selected: boolean;
  className: string;
  imageClassName: string;
  outlineInset: string;
}) {
  return (
    <span className={cn("relative inline-flex items-center justify-center", className)}>
      {selected ? (
        <span aria-hidden="true" className={cn("pointer-events-none absolute", outlineInset)}>
          <LanguageFlag
            code={code}
            className="size-full"
            imageClassName="scale-100"
            imageStyle={{ filter: BRAND_FLAG_FILTER }}
          />
        </span>
      ) : null}
      <LanguageFlag code={code} className="size-full" imageClassName={imageClassName} />
    </span>
  );
}
