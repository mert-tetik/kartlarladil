import type { LanguageCode } from "@/types/domain";
import { cn } from "@/lib/utils";

const FLAG_LABELS: Record<LanguageCode, string> = {
  en: "İngilizce bayrağı",
  de: "Almanca bayrağı",
  ru: "Rusça bayrağı",
};

const FLAG_BACKGROUNDS: Record<Exclude<LanguageCode, "en">, string> = {
  de: "linear-gradient(to bottom, #111827 0 33.3%, #dc2626 33.3% 66.6%, #facc15 66.6% 100%)",
  ru: "linear-gradient(to bottom, #ffffff 0 33.3%, #2563eb 33.3% 66.6%, #dc2626 66.6% 100%)",
};

export function LanguageFlag({ code, className }: { code: LanguageCode; className?: string }) {
  if (code === "en") {
    return (
      <span
        role="img"
        aria-label={FLAG_LABELS[code]}
        className={cn(
          "relative inline-block h-4 w-6 shrink-0 overflow-hidden rounded-[3px] border border-slate-300 bg-white",
          className,
        )}
      >
        <span className="absolute inset-y-0 left-1/2 w-[18%] -translate-x-1/2 bg-red-600" aria-hidden="true" />
        <span className="absolute inset-x-0 top-1/2 h-[28%] -translate-y-1/2 bg-red-600" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={FLAG_LABELS[code]}
      className={cn("inline-block h-4 w-6 shrink-0 rounded-[3px] border border-slate-300", className)}
      style={{ background: FLAG_BACKGROUNDS[code] }}
    />
  );
}
