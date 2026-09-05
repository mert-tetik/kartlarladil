"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MessageCircle, UsersRound } from "lucide-react";
import { MobileLanguageBottomSheet } from "@/app/components/mobile-language-bottom-sheet";
import { readLandingCardLanguage } from "@/app/components/landing-card-language";
import { LanguageFlag } from "@/components/language-flag";
import { setMobileNavbarBackOverride } from "@/components/mobile-navbar-back";
import { LANGUAGES } from "@/data/languages";
import { UpgradeDialog, type UpgradeDialogErrorCode } from "@/features/subscriptions/components/upgrade-dialog";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import {
  getAiPracticeChatBackground,
  getAiPracticeScenarioChatBackground,
} from "@/features/ai-practice/ai-practice-chat-backgrounds";
import { getAiPracticeCharacters, getCharacterName } from "@/features/ai-practice/ai-practice-data";
import {
  getAiPracticeScenarios,
  getScenarioProfession,
  getScenarioSummary,
  getScenarioTitle,
  type AiPracticeMode,
} from "@/features/ai-practice/ai-practice-scenarios";
import { getLanguageDisplayName } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { navigateWithRouteTransition } from "@/lib/route-transition";
import { vibrate } from "@/lib/vibration";

import type { LanguageCode, LocaleCode, Tier } from "@/types/domain";

export function AiPracticeCharacterSelection({
  language,
  locale: serverLocale,
  tier,
  initialMode = "character",
}: {
  language: LanguageCode;
  locale: LocaleCode;
  tier: Tier;
  initialMode?: AiPracticeMode;
}) {
  const router = useRouter();
  const { locale: clientLocale } = useLocale();
  const t = useT();
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(language);
  const [languageSheetOpen, setLanguageSheetOpen] = useState(false);
  const [upgradeDialogError, setUpgradeDialogError] = useState<UpgradeDialogErrorCode | null>(null);
  const [mode, setMode] = useState<AiPracticeMode>(initialMode);
  const locale = clientLocale ?? serverLocale;
  const { entitlements } = useSubscription();
  // Subscription data starts as null while it is being refreshed. Fail closed
  // here so a scenario card cannot navigate to tier selection before access is
  // known. Once a paid entitlement arrives, the cards unlock normally.
  const scenarioLocked = entitlements == null || entitlements.effectivePlan === "free";
  const languageOptions = LANGUAGES.map((language) => ({ code: language.code, count: 0 }));

  useEffect(() => {
    setMobileNavbarBackOverride(true);

    return () => {
      setMobileNavbarBackOverride(false);
    };
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) {
      return;
    }

    const landingLanguage = readLandingCardLanguage();
    if (!landingLanguage || landingLanguage === language) {
      return;
    }

    const languageSyncTimer = window.setTimeout(() => {
      setSelectedLanguage(landingLanguage);
    }, 0);
    navigateWithRouteTransition(() => {
      router.replace(`/ai-practice/${landingLanguage}/character?tier=${tier}&mode=${mode}`);
    });

    return () => window.clearTimeout(languageSyncTimer);
  }, [language, mode, router, tier]);

  function handleLanguageChange(code: LanguageCode) {
    setSelectedLanguage(code);
    navigateWithRouteTransition(() => router.replace(`/ai-practice/${code}/character?tier=${tier}&mode=${mode}`));
  }

  return (
    <div
      className="w-full overflow-y-auto rounded-lg border border-border bg-background p-3 lg:mx-auto lg:h-[480px] lg:max-w-5xl max-lg:mx-auto max-lg:flex-1 max-lg:h-full max-lg:min-h-0 max-lg:w-[calc(100%_-_1.5rem)] max-lg:overscroll-contain max-lg:touch-pan-y max-lg:pb-4"
      data-ai-practice-character-container
    >
      <div className="mb-4">
        <button
          data-ai-practice-language-button
          type="button"
          onClick={() => {
            vibrate("tap");
            setLanguageSheetOpen(true);
          }}
          className="flex w-full shrink-0 items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-1.5 text-left text-slate-950 transition-colors hover:bg-slate-100"
        >
          <span className="flex items-center gap-3">
            <LanguageFlag code={selectedLanguage} className="h-6 w-9" />
            <span className="text-base font-semibold text-slate-950">
              {getLanguageDisplayName(selectedLanguage, locale)}
            </span>
          </span>
          <span className="text-xs font-semibold text-slate-500">{t("home.mobile.cardLanguage")}</span>
        </button>
      </div>

      <div className="mb-4 rounded-xl bg-background-muted p-1" data-ai-practice-mode-switch>
        <p className="sr-only">{t("page.aiPractice.modeLabel")}</p>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              vibrate("tap");
              setMode("character");
            }}
            aria-pressed={mode === "character"}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${mode === "character" ? "bg-background-card text-foreground shadow-sm" : "text-foreground-secondary hover:text-foreground"}`}
          >
            <UsersRound className="size-4" aria-hidden="true" />
            {t("page.aiPractice.characterMode")}
          </button>
          <button
            type="button"
            onClick={() => {
              vibrate("tap");
              setMode("scenario");
            }}
            aria-pressed={mode === "scenario"}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${mode === "scenario" ? "bg-background-card text-foreground shadow-sm" : "text-foreground-secondary hover:text-foreground"}`}
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {t("page.aiPractice.scenarioMode")}
          </button>
        </div>
      </div>

      <MobileLanguageBottomSheet
        isOpen={languageSheetOpen}
        onClose={() => setLanguageSheetOpen(false)}
        options={languageOptions}
        selectedLanguage={selectedLanguage}
        onSelect={(code) => {
          setSelectedLanguage(code);
          handleLanguageChange(code);
        }}
        showBackdrop
        sheetClassName="max-h-[50dvh]"
        showCounts={false}
        optionStyle="navbar"
      />

      {mode === "character" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4 xl:grid-cols-5" data-ai-practice-character-list>
          {getAiPracticeCharacters().map((character) => (
            <CharacterPracticeCard
              key={character.id}
              character={character}
              selectedLanguage={selectedLanguage}
              locale={locale}
              href={`/ai-practice/${selectedLanguage}?character=${character.id}`}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4 xl:grid-cols-5" data-ai-practice-scenario-list>
          {getAiPracticeScenarios().map((scenario) => {
            const character = getAiPracticeCharacters().find((item) => item.id === scenario.characterId);

            if (!character) {
              return null;
            }

            return (
              <ScenarioPracticeCard
                key={scenario.id}
                scenario={scenario}
                locale={locale}
                locked={scenarioLocked}
                onLocked={() => setUpgradeDialogError("scenario_subscription_required")}
                href={`/ai-practice/${selectedLanguage}?mode=scenario&scenario=${scenario.id}`}
              />
            );
          })}
        </div>
      )}

      {upgradeDialogError ? (
        <UpgradeDialog
          open
          errorCode={upgradeDialogError}
          onOpenChange={(open) => {
            if (!open) {
              setUpgradeDialogError(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function CharacterPracticeCard({
  character,
  selectedLanguage,
  locale,
  href,
}: {
  character: ReturnType<typeof getAiPracticeCharacters>[number];
  selectedLanguage: LanguageCode;
  locale: LocaleCode;
  href: string;
}) {
  const characterName = getCharacterName(character, selectedLanguage);
  const chatBackground = getAiPracticeChatBackground(character.id);

  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-lg border border-border bg-background-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      <div
        className="relative aspect-square overflow-hidden bg-background-muted"
        style={{ backgroundImage: `${chatBackground.overlay}, url(${chatBackground.imageSrc})` }}
      >
        <Image
          src={character.imageSrc}
          alt={characterName}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
          className="scale-[1.08] object-contain object-bottom transition-transform duration-300 group-hover:scale-[1.11]"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">{characterName}</h2>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-foreground-secondary">
              {character.summaryByLocale[locale]}
            </p>
          </div>
          <ArrowRight
            className="mt-1 size-4 shrink-0 text-foreground-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  );
}

function ScenarioPracticeCard({
  scenario,
  locale,
  locked,
  onLocked,
  href,
}: {
  scenario: ReturnType<typeof getAiPracticeScenarios>[number];
  locale: LocaleCode;
  locked: boolean;
  onLocked: () => void;
  href: string;
}) {
  const t = useT();
  const chatBackground = getAiPracticeScenarioChatBackground(scenario.id);
  const title = getScenarioTitle(scenario, locale);
  const profession = getScenarioProfession(scenario, locale);

  return (
    <Link
      href={href}
      aria-disabled={locked}
      data-ai-practice-scenario-locked={locked ? "true" : "false"}
      onClick={(event) => {
        if (locked) {
          event.preventDefault();
          onLocked();
        }
      }}
      aria-label={`${title}, ${getScenarioSummary(scenario, locale)}`}
      className="group overflow-hidden rounded-lg border border-border bg-background-card transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      <div
        className="relative aspect-square overflow-hidden bg-background-muted"
        style={{ backgroundImage: `${chatBackground.overlay}, url(${chatBackground.imageSrc})` }}
      >
        <Image
          src={scenario.characterImageSrc}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
          className="scale-[1.08] object-contain object-bottom transition-transform duration-300 group-hover:scale-[1.11]"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="line-clamp-2 text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-1 line-clamp-2 text-sm leading-5 text-foreground-secondary">
              {getScenarioSummary(scenario, locale)}
            </p>
            <p className="mt-2 text-xs font-semibold text-foreground-muted">
              {t("page.aiPractice.scenarioCharacter", { name: profession })}
            </p>
          </div>
          <ArrowRight
            className="mt-1 size-4 shrink-0 text-foreground-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  );
}
