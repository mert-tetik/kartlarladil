import { LANGUAGES } from "@/data/languages";
import { TIERS, TIER_LABELS } from "@/data/tiers";
import { LanguageFlag } from "@/components/language-flag";
import { FieldError } from "@/features/auth/components/form-message";
import { cn } from "@/lib/utils";
import type { LanguageCode, Tier } from "@/types/domain";

export function PreferenceFields({
  defaultLanguage = "en",
  defaultTier = "A1",
  languageError,
  tierError,
}: {
  defaultLanguage?: LanguageCode | null;
  defaultTier?: Tier | null;
  languageError?: string;
  tierError?: string;
}) {
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">Hangi dili öğrenmek istiyorsun?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {LANGUAGES.map((language) => (
            <label key={language.code} className="block">
              <input
                className="peer sr-only"
                type="radio"
                name="preferredLanguageCode"
                value={language.code}
                defaultChecked={(defaultLanguage ?? "en") === language.code}
                required
              />
              <span
                className={cn(
                  "flex h-12 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors",
                  "peer-checked:border-slate-950 peer-checked:bg-slate-950 peer-checked:text-white",
                  "hover:border-slate-400",
                )}
              >
                <LanguageFlag code={language.code} />
                {language.name}
              </span>
            </label>
          ))}
        </div>
        <FieldError message={languageError} />
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">Hangi seviyeden başlayalım?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {TIERS.map((tier) => (
            <label key={tier} className="block">
              <input
                className="peer sr-only"
                type="radio"
                name="preferredTier"
                value={tier}
                defaultChecked={(defaultTier ?? "A1") === tier}
                required
              />
              <span
                className={cn(
                  "flex h-12 flex-col justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors",
                  "peer-checked:border-slate-950 peer-checked:bg-slate-950 peer-checked:text-white",
                  "hover:border-slate-400",
                )}
              >
                <span>{tier}</span>
                <span className="text-xs font-semibold opacity-70">{TIER_LABELS[tier]}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError message={tierError} />
      </fieldset>
    </div>
  );
}
