"use client";

import { useSyncExternalStore } from "react";
import { matchSupportedLocale } from "@/data/languages";
import type { LocaleCode } from "@/types/domain";

export function useDetectedLocale(): LocaleCode {
  return useSyncExternalStore<LocaleCode>(
    () => () => {},
    () => matchSupportedLocale(navigator.language) ?? "tr",
    () => "tr",
  );
}
