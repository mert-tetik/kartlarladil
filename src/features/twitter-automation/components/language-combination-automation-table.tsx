"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  ChevronDown,
  Clock3,
  FileText,
  Globe2,
  ImageIcon,
  Info,
  Layers3,
  LockKeyhole,
  RefreshCw,
  Save,
  Sparkles,
  UsersRound,
  Video,
} from "lucide-react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppMessage } from "@/components/app-message-provider";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { GeneratedPostsTable } from "@/features/twitter-automation/components/generated-posts-table";
import { unlockMusicVideoAudio } from "@/features/twitter-automation/music-video-renderer";
import { automationScopeSearchParams } from "@/features/twitter-automation/automation-scope";
import {
  AUTOMATION_CONTENT_TYPES,
  AUTOMATION_GENERATOR_OPTIONS,
  RANDOM_GENERATOR,
  RANDOM_INCLUDE_OPTIONS,
  normalizeRandomIncludes,
  type AutomationContentType,
} from "@/features/twitter-automation/automation-randomization";
import {
  estimateAutomationGroupCost,
  formatAutomationCostTry,
  type AutomationCostRow,
} from "@/features/twitter-automation/automation-cost-estimates";
import {
  normalizeDailyQuantities,
  type DailyQuantities,
} from "@/features/twitter-automation/language-combination-planning";
import { supportedUploadPostContentTypes } from "@/features/twitter-automation/upload-post-capabilities";
import { cn } from "@/lib/utils";
import type { LanguageCode, Tier } from "@/types/domain";

type Platform = string;
type LanguageSelection = LanguageCode | "random";
type TierSelection = Tier | "random";
type SyncState = "loading" | "saved" | "saving" | "error";

type SocialMediaAccount = {
  id: string;
  platform: Platform;
  platformLabel: string;
  accountName: string;
};

type ComboSettings = {
  dailyQuantities: DailyQuantities;
  generators: Partial<Record<AutomationContentType, string>>;
  randomIncludes: Partial<Record<AutomationContentType, string[]>>;
  language: LanguageSelection;
  nativeLanguage: LanguageSelection;
  tier: TierSelection;
};

type LanguageCombination = ComboSettings & {
  id: string;
  accounts: SocialMediaAccount[];
  accountContentTypes: Record<string, AutomationContentType[]>;
  saved: boolean;
};

type StoredAccountSettings = {
  contentType?: "random" | AutomationContentType;
  generator?: string;
  contentTypes?: AutomationContentType[];
  generators?: Partial<Record<AutomationContentType, string>>;
  randomIncludes?: Partial<Record<AutomationContentType, string[]>>;
  dailyQuantities?: Partial<DailyQuantities>;
  quantity?: number;
  language?: LanguageSelection;
  nativeLanguage?: LanguageSelection;
  tier?: TierSelection;
};

type StoredAutomationRow = {
  id?: string;
  contentType?: "random" | AutomationContentType;
  generator?: string;
  contentTypes?: AutomationContentType[];
  generators?: Partial<Record<AutomationContentType, string>>;
  randomIncludes?: Partial<Record<AutomationContentType, string[]>>;
  dailyQuantities?: Partial<DailyQuantities>;
  accountContentTypes?: Record<string, AutomationContentType[]>;
  quantity?: number;
  language?: LanguageSelection;
  nativeLanguage?: LanguageSelection;
  tier?: TierSelection;
  platforms?: string[];
  accounts?: Record<string, string[]>;
  accountIds?: string[];
  settingsByAccount?: Record<string, StoredAccountSettings>;
  saved?: boolean;
};

type StoredAutomationGroup = { rows?: StoredAutomationRow[] };

const CONTENT_TYPE_META: Array<{
  value: AutomationContentType;
  label: string;
  icon: typeof FileText;
}> = [
  { value: "text", label: "Text", icon: FileText },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video },
];
const QUANTITY_OPTIONS = Array.from({ length: 20 }, (_, index) => index + 1);
const FIXED_SCHEDULE_START = "11:00";
const FIXED_SCHEDULE_END = "23:00";
const LANGUAGE_COMBINATION_GROUP_ID = "c8e24d58-0d1d-4bc0-9c9a-7df4f7bd4a21";
const CONTROL_CLASS =
  "h-10 w-full rounded-md border border-[#dce6df] bg-white px-3 text-sm font-medium text-[#1b2a21] outline-none transition focus:border-[#2f7251] focus:ring-2 focus:ring-[#2f7251]/15";
const COMBO_COLORS = [
  "#2563eb",
  "#d62976",
  "#0f766e",
  "#ea580c",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#15803d",
];
const PLATFORM_COLORS: Record<string, string> = {
  facebook: "#1877f2",
  instagram: "#d62976",
  pinterest: "#e60023",
  threads: "#111111",
  tiktok: "#00a884",
  telegram: "#229ed9",
  youtube: "#ff0000",
  x: "#111111",
};
const PLATFORM_ICON_PATHS: Record<string, string> = {
  facebook: "/automation-group-icons/social/facebook.svg",
  instagram: "/automation-group-icons/social/instagram.svg",
  pinterest: "/automation-group-icons/social/pinterest.svg",
  threads: "/automation-group-icons/social/threads.svg",
  tiktok: "/automation-group-icons/social/tiktok.svg",
  youtube: "/automation-group-icons/social/youtube.svg",
  x: "/automation-group-icons/social/x.svg",
};

function platformColor(platform: string, index: number) {
  return (
    PLATFORM_COLORS[platform] ??
    ["#6d28d9", "#0891b2", "#ea580c", "#15803d"][index % 4]!
  );
}

function languageSelectionLabel(value: LanguageSelection) {
  return value === "random"
    ? "Random"
    : (LANGUAGE_BY_CODE[value]?.name ?? value);
}

function isLanguageSelection(value: unknown): value is LanguageSelection {
  return (
    value === "random" ||
    (typeof value === "string" && value in LANGUAGE_BY_CODE)
  );
}

function isTierSelection(value: unknown): value is TierSelection {
  return (
    value === "random" ||
    (typeof value === "string" && TIERS.includes(value as Tier))
  );
}

function comboKey(
  nativeLanguage: LanguageSelection,
  language: LanguageSelection,
) {
  return `${nativeLanguage}->${language}`;
}

function comboSettingsFromRow(
  row: StoredAutomationRow | undefined,
  account: SocialMediaAccount,
): ComboSettings {
  // A legacy linked row may contain per-account snapshots. The combo itself
  // must use the row's source settings; the first account encountered becomes
  // the canonical settings for accounts sharing the same language pair.
  const source = row;
  const supported = supportedUploadPostContentTypes(account.platform);
  const legacyContentTypes =
    source?.contentTypes?.filter((contentType) =>
      supported.includes(contentType),
    ) ??
    (source?.contentType &&
    source.contentType !== "random" &&
    supported.includes(source.contentType)
      ? [source.contentType]
      : []);
  const contentTypes = legacyContentTypes.length
    ? [...new Set(legacyContentTypes)]
    : supported;
  const legacyQuantities = Object.fromEntries(
    contentTypes.map((contentType) => [
      contentType,
      Math.max(1, Math.min(20, source?.quantity ?? 1)),
    ]),
  ) as Partial<DailyQuantities>;
  const dailyQuantities = source?.dailyQuantities
    ? normalizeDailyQuantities(source.dailyQuantities)
    : normalizeDailyQuantities(legacyQuantities);
  const generators = { ...source?.generators };
  const randomIncludes = { ...source?.randomIncludes };
  for (const contentType of AUTOMATION_CONTENT_TYPES) {
    if (
      dailyQuantities[contentType] > 0 ||
      contentTypes.includes(contentType)
    ) {
      generators[contentType] =
        generators[contentType] ??
        (contentTypes.length === 1 && source?.generator
          ? source.generator
          : RANDOM_GENERATOR);
      randomIncludes[contentType] = normalizeRandomIncludes(
        contentType,
        randomIncludes[contentType],
      );
    }
  }
  return {
    dailyQuantities,
    generators,
    randomIncludes,
    language: isLanguageSelection(source?.language) ? source.language : "en",
    nativeLanguage: isLanguageSelection(source?.nativeLanguage)
      ? source.nativeLanguage
      : "en",
    tier: isTierSelection(source?.tier) ? source.tier : "random",
  };
}

function accountDeliveryTypes(
  row: StoredAutomationRow | undefined,
  account: SocialMediaAccount,
) {
  const stored =
    row?.accountContentTypes?.[account.id] ??
    row?.settingsByAccount?.[account.id]?.contentTypes ??
    row?.contentTypes;
  const supported = new Set(supportedUploadPostContentTypes(account.platform));
  if (!stored) return [...supported] as AutomationContentType[];
  return AUTOMATION_CONTENT_TYPES.filter(
    (contentType) => stored.includes(contentType) && supported.has(contentType),
  );
}

function createCombination(
  account: SocialMediaAccount,
  settings: ComboSettings,
  deliveryTypes: AutomationContentType[],
  id = crypto.randomUUID(),
): LanguageCombination {
  return {
    ...settings,
    id,
    accounts: [account],
    accountContentTypes: { [account.id]: deliveryTypes },
    saved: true,
  };
}

function hydrateCombinations(
  accounts: SocialMediaAccount[],
  groups: StoredAutomationGroup[] | undefined,
) {
  const rows = (groups ?? []).flatMap((group) => group.rows ?? []);
  const combinations: LanguageCombination[] = [];
  const orderedAccounts = [...accounts].sort(
    (first, second) =>
      first.platformLabel.localeCompare(second.platformLabel) ||
      first.accountName.localeCompare(second.accountName),
  );

  for (const account of orderedAccounts) {
    const row = rows.find(
      (candidate) =>
        candidate.accounts?.[account.platform]?.includes(account.id) ||
        candidate.accountIds?.includes(account.id),
    );
    const settings = comboSettingsFromRow(row, account);
    const key = comboKey(settings.nativeLanguage, settings.language);
    const existing = combinations.find(
      (combination) =>
        comboKey(combination.nativeLanguage, combination.language) === key,
    );
    const deliveryTypes = accountDeliveryTypes(row, account);
    if (!existing) {
      const storedId =
        row?.id &&
        /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu.test(
          row.id,
        )
          ? row.id
          : undefined;
      combinations.push(
        createCombination(account, settings, deliveryTypes, storedId),
      );
    } else {
      existing.accounts.push(account);
      existing.accountContentTypes[account.id] = deliveryTypes;
    }
  }

  return combinations;
}

function contentTypeHasRecipients(
  combination: LanguageCombination,
  contentType: AutomationContentType,
) {
  return combination.accounts.some((account) =>
    combination.accountContentTypes[account.id]?.includes(contentType),
  );
}

function effectiveDailyQuantity(
  combination: LanguageCombination,
  contentType: AutomationContentType,
) {
  return contentTypeHasRecipients(combination, contentType)
    ? combination.dailyQuantities[contentType]
    : 0;
}

function effectiveOutputCount(combination: LanguageCombination) {
  return AUTOMATION_CONTENT_TYPES.reduce(
    (total, contentType) =>
      total + effectiveDailyQuantity(combination, contentType),
    0,
  );
}

function toCostRows(combination: LanguageCombination): AutomationCostRow[] {
  return AUTOMATION_CONTENT_TYPES.flatMap((contentType) => {
    const quantity = effectiveDailyQuantity(combination, contentType);
    if (!quantity) return [];
    return [
      {
        contentType,
        generator: combination.generators[contentType] ?? RANDOM_GENERATOR,
        contentTypes: [contentType],
        generators: {
          [contentType]:
            combination.generators[contentType] ?? RANDOM_GENERATOR,
        },
        randomIncludes: {
          [contentType]: combination.randomIncludes[contentType],
        },
        quantity,
      },
    ];
  });
}

function serializeCombinations(combinations: readonly LanguageCombination[]) {
  return {
    groups: [
      {
        id: LANGUAGE_COMBINATION_GROUP_ID,
        name: "Language combinations",
        tone: "blue",
        color: "#2563eb",
        icon: "flag",
        collapsed: false,
        rows: combinations
          .filter((combination) => combination.accounts.length)
          .map((combination) => {
            const activeTypes = AUTOMATION_CONTENT_TYPES.filter(
              (contentType) => combination.dailyQuantities[contentType] > 0,
            );
            const legacyTypes = activeTypes.length
              ? activeTypes
              : ["text" as const];
            const generators = { ...combination.generators };
            for (const contentType of legacyTypes)
              generators[contentType] =
                generators[contentType] ?? RANDOM_GENERATOR;
            const accounts = combination.accounts.reduce<
              Record<string, string[]>
            >(
              (result, account) => ({
                ...result,
                [account.platform]: [
                  ...(result[account.platform] ?? []),
                  account.id,
                ],
              }),
              {},
            );
            return {
              id: combination.id,
              contentType: legacyTypes.length === 1 ? legacyTypes[0] : "random",
              // The API's legacy contentType field is only a compatibility hint;
              // "random-content" was never a valid persisted enum value. The
              // per-type generators and dailyQuantities carry the real plan.
              generator:
                legacyTypes.length === 1
                  ? (generators[legacyTypes[0]] ?? RANDOM_GENERATOR)
                  : RANDOM_GENERATOR,
              contentTypes: legacyTypes,
              generators,
              randomIncludes: combination.randomIncludes,
              dailyQuantities: combination.dailyQuantities,
              accountContentTypes: combination.accountContentTypes,
              quantity: activeTypes.length
                ? Math.max(
                    ...activeTypes.map(
                      (contentType) => combination.dailyQuantities[contentType],
                    ),
                  )
                : 1,
              language: combination.language,
              nativeLanguage: combination.nativeLanguage,
              tier: combination.tier,
              platforms: [
                ...new Set(
                  combination.accounts.map((account) => account.platform),
                ),
              ],
              accounts,
              scheduleStart: FIXED_SCHEDULE_START,
              scheduleEnd: FIXED_SCHEDULE_END,
              saved: true,
            };
          }),
      },
    ],
    superGroups: [],
  };
}

function PlatformGlyph({
  platform,
  color,
  size = "size-9",
}: {
  platform: string;
  color: string;
  size?: string;
}) {
  const iconPath = PLATFORM_ICON_PATHS[platform];
  if (iconPath)
    return (
      <span
        className={cn("grid shrink-0 place-items-center rounded-md", size)}
        style={{ backgroundColor: color }}
      >
        <Image
          alt=""
          aria-hidden="true"
          className="size-5 object-contain brightness-0 invert"
          height={20}
          src={iconPath}
          unoptimized
          width={20}
        />
      </span>
    );
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-md text-white",
        size,
      )}
      style={{ backgroundColor: color }}
    >
      <Globe2 aria-hidden="true" className="size-5" />
    </span>
  );
}

function LanguageSelect({
  label,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  value: LanguageSelection;
  onChange: (value: LanguageSelection) => void;
  compact?: boolean;
}) {
  return (
    <label className="min-w-0 space-y-1">
      <span className="block text-[10px] font-semibold text-[#6f7f75]">
        {label}
      </span>
      <div className="relative">
        <select
          aria-label={label}
          className={cn(
            CONTROL_CLASS,
            compact ? "h-8 px-2 text-xs" : "appearance-none pl-3 pr-8",
          )}
          onChange={(event) =>
            onChange(event.target.value as LanguageSelection)
          }
          value={value}
        >
          <option value="random">Random</option>
          {Object.values(LANGUAGE_BY_CODE).map((language) => (
            <option key={language.code} value={language.code}>
              {language.name}
            </option>
          ))}
        </select>
        {!compact ? (
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[#809087]"
          />
        ) : null}
      </div>
    </label>
  );
}

function GeneratorControl({
  combination,
  contentType,
  onChange,
  onToggleInclude,
}: {
  combination: LanguageCombination;
  contentType: AutomationContentType;
  onChange: (generator: string) => void;
  onToggleInclude: (include: string) => void;
}) {
  const generator = combination.generators[contentType] ?? RANDOM_GENERATOR;
  const includes = normalizeRandomIncludes(
    contentType,
    combination.randomIncludes[contentType],
  );
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold text-[#6f7f75]">
          {CONTENT_TYPE_META.find((item) => item.value === contentType)?.label}{" "}
          generator
        </span>
        {generator === RANDOM_GENERATOR ? (
          <span className="rounded-full bg-[#edf4ef] px-2 py-0.5 text-[10px] font-semibold text-[#2f7251]">
            Pool random
          </span>
        ) : null}
      </div>
      <select
        aria-label={`${contentType} generator`}
        className={cn(CONTROL_CLASS, "h-9 text-xs")}
        onChange={(event) => onChange(event.target.value)}
        value={generator}
      >
        {AUTOMATION_GENERATOR_OPTIONS[contentType].map((option) => (
          <option key={option.value} value={option.value}>
            {option.source
              ? `${option.label} · ${option.source}`
              : option.label}
          </option>
        ))}
      </select>
      {generator === RANDOM_GENERATOR ? (
        <div className="flex flex-wrap gap-1.5">
          {RANDOM_INCLUDE_OPTIONS[contentType].map((option) => {
            const selected = includes.includes(option.value);
            return (
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold",
                  selected
                    ? "border-[#2f7251]/25 bg-[#e4f1e7] text-[#2f7251]"
                    : "border-[#dce6df] bg-white text-[#85948b]",
                )}
                key={option.value}
              >
                <input
                  aria-label={`${contentType} include ${option.label}`}
                  checked={selected}
                  className="size-3 accent-[#2f7251]"
                  onChange={() => onToggleInclude(option.value)}
                  type="checkbox"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PoolContentRow({
  combination,
  contentType,
  onToggle,
  onQuantityChange,
  onGeneratorChange,
  onToggleInclude,
}: {
  combination: LanguageCombination;
  contentType: AutomationContentType;
  onToggle: () => void;
  onQuantityChange: (quantity: number) => void;
  onGeneratorChange: (generator: string) => void;
  onToggleInclude: (include: string) => void;
}) {
  const Icon =
    CONTENT_TYPE_META.find((item) => item.value === contentType)?.icon ??
    FileText;
  const enabled = combination.dailyQuantities[contentType] > 0;
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition",
        enabled ? "border-[#cbded0] bg-[#f7fbf7]" : "border-[#e5ebe6] bg-white",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <button
          aria-pressed={enabled}
          className={cn(
            "flex min-w-28 items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-semibold transition",
            enabled ? "bg-[#2f7251] text-white" : "bg-[#eef2ee] text-[#75847b]",
          )}
          onClick={onToggle}
          type="button"
        >
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          <span>
            {
              CONTENT_TYPE_META.find((item) => item.value === contentType)
                ?.label
            }
          </span>
        </button>
        {enabled ? (
          <label className="w-28 space-y-1">
            <span className="block text-[10px] font-semibold text-[#6f7f75]">
              Per day
            </span>
            <select
              aria-label={`${contentType} outputs per day`}
              className={cn(CONTROL_CLASS, "h-9 text-sm font-semibold")}
              onChange={(event) => onQuantityChange(Number(event.target.value))}
              value={combination.dailyQuantities[contentType]}
            >
              {QUANTITY_OPTIONS.map((quantity) => (
                <option key={quantity} value={quantity}>
                  {quantity}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="pt-2 text-xs text-[#93a098]">Not generated</span>
        )}
      </div>
      {enabled ? (
        <div className="mt-3 border-t border-[#e1ebe2] pt-3">
          <GeneratorControl
            combination={combination}
            contentType={contentType}
            onChange={onGeneratorChange}
            onToggleInclude={onToggleInclude}
          />
        </div>
      ) : null}
    </div>
  );
}

function AccountDistributionRow({
  account,
  index,
  nativeLanguage,
  language,
  selectedTypes,
  onToggleType,
  onLanguageChange,
}: {
  account: SocialMediaAccount;
  index: number;
  nativeLanguage: LanguageSelection;
  language: LanguageSelection;
  selectedTypes: readonly AutomationContentType[];
  onToggleType: (contentType: AutomationContentType) => void;
  onLanguageChange: (
    field: "nativeLanguage" | "language",
    value: LanguageSelection,
  ) => void;
}) {
  const supported = new Set(supportedUploadPostContentTypes(account.platform));
  const color = platformColor(account.platform, index);
  return (
    <div className="rounded-lg border border-[#e0e9e1] bg-white p-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <PlatformGlyph color={color} platform={account.platform} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#1b2a21]">
            {account.accountName}
          </p>
          <p className="truncate text-[11px] text-[#819087]">
            {account.platformLabel}
          </p>
        </div>
        <span className="text-[10px] font-semibold text-[#7a897f]">
          {selectedTypes.length} selected
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <LanguageSelect
          compact
          label="Native language"
          onChange={(value) => onLanguageChange("nativeLanguage", value)}
          value={nativeLanguage}
        />
        <LanguageSelect
          compact
          label="Learning language"
          onChange={(value) => onLanguageChange("language", value)}
          value={language}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CONTENT_TYPE_META.map(({ value, label, icon: Icon }) => {
          const isSupported = supported.has(value);
          const selected = selectedTypes.includes(value);
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition",
                !isSupported
                  ? "cursor-not-allowed border-[#e6ebe7] bg-[#f2f4f2] text-[#a4aea7]"
                  : selected
                    ? "border-transparent text-white"
                    : "border-[#dce6df] bg-white text-[#718077] hover:bg-[#f4f8f4]",
              )}
              disabled={!isSupported}
              key={value}
              onClick={() => onToggleType(value)}
              style={
                selected && isSupported ? { backgroundColor: color } : undefined
              }
              title={
                !isSupported
                  ? "Not supported by Upload-Post for this platform"
                  : undefined
              }
              type="button"
            >
              {!isSupported ? (
                <LockKeyhole aria-hidden="true" className="size-3.5" />
              ) : (
                <Icon aria-hidden="true" className="size-3.5" />
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ComboCostSummary({
  combination,
}: {
  combination: LanguageCombination;
}) {
  const estimate = estimateAutomationGroupCost(toCostRows(combination));
  return (
    <div className="rounded-lg bg-[#edf3ef] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[#53665a]">
          Estimated generation cost
        </span>
        <span className="text-[10px] text-[#7b8b80]">AI only</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <span className="block text-[10px] text-[#7b8b80]">Daily</span>
          <strong className="mt-0.5 block text-sm font-semibold text-[#253a2c]">
            {formatAutomationCostTry(estimate.oneOffTry)}
          </strong>
        </div>
        <div>
          <span className="block text-[10px] text-[#7b8b80]">Monthly</span>
          <strong className="mt-0.5 block text-sm font-semibold text-[#253a2c]">
            {formatAutomationCostTry(estimate.monthlyTry)}
          </strong>
        </div>
      </div>
    </div>
  );
}

function CombinationCard({
  combination,
  color,
  onUpdate,
  onTogglePoolType,
  onToggleAccountType,
  onGeneratorChange,
  onToggleInclude,
  onQuantityChange,
  onLanguageChange,
}: {
  combination: LanguageCombination;
  color: string;
  onUpdate: (update: Partial<LanguageCombination>) => void;
  onTogglePoolType: (contentType: AutomationContentType) => void;
  onToggleAccountType: (
    accountId: string,
    contentType: AutomationContentType,
  ) => void;
  onGeneratorChange: (
    contentType: AutomationContentType,
    generator: string,
  ) => void;
  onToggleInclude: (
    contentType: AutomationContentType,
    include: string,
  ) => void;
  onQuantityChange: (
    contentType: AutomationContentType,
    quantity: number,
  ) => void;
  onLanguageChange: (
    accountId: string,
    field: "nativeLanguage" | "language",
    value: LanguageSelection,
  ) => void;
}) {
  const dailyOutputCount = effectiveOutputCount(combination);
  return (
    <section className="overflow-hidden rounded-xl border border-[#d8e4da] bg-white shadow-sm">
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-white sm:px-5"
        style={{ backgroundColor: color }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Globe2 aria-hidden="true" className="size-5 shrink-0" />
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-base font-semibold">
              <span className="truncate">
                {languageSelectionLabel(combination.nativeLanguage)}
              </span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">
                {languageSelectionLabel(combination.language)}
              </span>
            </h3>
            <p className="mt-0.5 text-[11px] text-white/75">
              {combination.accounts.length} account
              {combination.accounts.length === 1 ? "" : "s"} ·{" "}
              {dailyOutputCount} active outputs/day
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-white/80">
          <UsersRound aria-hidden="true" className="size-4" />
          Shared language pool
        </div>
      </header>
      <div className="grid divide-y divide-[#e1e9e2] lg:grid-cols-[1.05fr_1fr] lg:divide-x lg:divide-y-0">
        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-[#17291f]">
                  Generation pool
                </h4>
                <p className="mt-0.5 text-xs text-[#718077]">
                  Generate each type once for this language combination.
                </p>
              </div>
              <span className="rounded-full bg-[#edf4ef] px-2.5 py-1 text-[10px] font-semibold text-[#2f7251]">
                {dailyOutputCount}/day
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {AUTOMATION_CONTENT_TYPES.map((contentType) => (
                <PoolContentRow
                  combination={combination}
                  contentType={contentType}
                  key={contentType}
                  onGeneratorChange={(generator) =>
                    onGeneratorChange(contentType, generator)
                  }
                  onQuantityChange={(quantity) =>
                    onQuantityChange(contentType, quantity)
                  }
                  onToggle={() => onTogglePoolType(contentType)}
                  onToggleInclude={(include) =>
                    onToggleInclude(contentType, include)
                  }
                />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold text-[#6f7f75]">
                Tier
              </span>
              <select
                aria-label="Language combination tier"
                className={CONTROL_CLASS}
                onChange={(event) =>
                  onUpdate({ tier: event.target.value as TierSelection })
                }
                value={combination.tier}
              >
                <option value="random">Random</option>
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg bg-[#f0f5f1] p-3 text-xs text-[#53665a]">
              <div className="flex items-center gap-1.5 font-semibold">
                <Clock3
                  aria-hidden="true"
                  className="size-3.5 text-[#2f7251]"
                />
                11:00–23:00
              </div>
              <p className="mt-1 text-[10px] leading-4 text-[#7b8b80]">
                Random publish time · İstanbul
              </p>
            </div>
          </div>
          <ComboCostSummary combination={combination} />
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-[#17291f]">
                Account distribution
              </h4>
              <p className="mt-0.5 text-xs text-[#718077]">
                Select which generated types each account receives.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[#7b8b80]">
              {combination.accounts.length} accounts
            </span>
          </div>
          <div className="space-y-2">
            {combination.accounts.map((account, index) => (
              <AccountDistributionRow
                account={account}
                index={index}
                key={account.id}
                language={combination.language}
                nativeLanguage={combination.nativeLanguage}
                onLanguageChange={(field, value) =>
                  onLanguageChange(account.id, field, value)
                }
                onToggleType={(contentType) =>
                  onToggleAccountType(account.id, contentType)
                }
                selectedTypes={
                  combination.accountContentTypes[account.id] ?? []
                }
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

async function readAutomationError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as {
    errorCode?: string;
  } | null;
  return new Error(
    payload?.errorCode ? `${fallback} (${payload.errorCode}).` : fallback,
  );
}

export function LanguageCombinationAutomationTable({
  onBack,
}: {
  onBack: () => void;
}) {
  const { showMessage } = useAppMessage();
  const [combinations, setCombinations] = useState<LanguageCombination[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [schedulingHorizon, setSchedulingHorizon] = useState<1 | 3 | 7 | null>(
    null,
  );
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isGeneratedPostsOpen, setIsGeneratedPostsOpen] = useState(false);
  const saveRequestId = useRef(0);
  const pendingAutoSaveTimeout = useRef<number | null>(null);
  const dirtyVersion = useRef(0);
  const savedVersion = useRef(0);
  const scopeSearchParams = automationScopeSearchParams("production");
  const accountCount = useMemo(
    () =>
      combinations.reduce(
        (total, combination) => total + combination.accounts.length,
        0,
      ),
    [combinations],
  );
  const platformCount = useMemo(
    () =>
      new Set(
        combinations.flatMap((combination) =>
          combination.accounts.map((account) => account.platform),
        ),
      ).size,
    [combinations],
  );
  const activeOutputCount = useMemo(
    () =>
      combinations.reduce(
        (total, combination) => total + effectiveOutputCount(combination),
        0,
      ),
    [combinations],
  );
  const configuredOutputCount = useMemo(
    () =>
      combinations.reduce(
        (total, combination) =>
          total +
          Object.values(combination.dailyQuantities).reduce(
            (sum, quantity) => sum + quantity,
            0,
          ),
        0,
      ),
    [combinations],
  );
  const dailyContentCounts = useMemo<DailyQuantities>(
    () => ({
      text: combinations.reduce(
        (total, combination) =>
          total + effectiveDailyQuantity(combination, "text"),
        0,
      ),
      image: combinations.reduce(
        (total, combination) =>
          total + effectiveDailyQuantity(combination, "image"),
        0,
      ),
      video: combinations.reduce(
        (total, combination) =>
          total + effectiveDailyQuantity(combination, "video"),
        0,
      ),
    }),
    [combinations],
  );
  const totalCost = useMemo(
    () => estimateAutomationGroupCost(combinations.flatMap(toCostRows)),
    [combinations],
  );

  const markDirty = useCallback(() => {
    dirtyVersion.current += 1;
  }, []);

  const loadAutomation = useCallback(async () => {
    setSyncState("loading");
    try {
      const [response, latestRunResponse] = await Promise.all([
        fetch(`/api/twitter-automation/automations${scopeSearchParams}`, {
          cache: "no-store",
        }),
        fetch(
          "/api/twitter-automation/automation-runs?scope=production&latest=1",
          { cache: "no-store" },
        ),
      ]);
      if (!response.ok)
        throw await readAutomationError(
          response,
          "Automation state could not be loaded.",
        );
      const payload = (await response.json()) as {
        groups?: StoredAutomationGroup[];
        socialAccounts?: SocialMediaAccount[];
      };
      const latestRunPayload = latestRunResponse.ok
        ? ((await latestRunResponse.json().catch(() => null)) as {
            latestRunId?: string | null;
            latestRun?: { status?: string } | null;
          } | null)
        : null;
      const nextCombinations = hydrateCombinations(
        Array.isArray(payload.socialAccounts) ? payload.socialAccounts : [],
        Array.isArray(payload.groups) ? payload.groups : [],
      );
      dirtyVersion.current += 1;
      savedVersion.current = dirtyVersion.current;
      setCombinations(nextCombinations);
      setActiveRunId(
        typeof latestRunPayload?.latestRunId === "string"
          ? latestRunPayload.latestRunId
          : null,
      );
      if (
        latestRunPayload?.latestRunId &&
        latestRunPayload.latestRun?.status !== "completed"
      ) {
        setIsGeneratedPostsOpen(true);
      }
      setSyncState("saved");
      setIsHydrated(true);
    } catch (error) {
      setSyncState("error");
      showMessage(
        error instanceof Error
          ? error.message
          : "Automation state could not be loaded.",
        "error",
      );
    }
  }, [scopeSearchParams, showMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAutomation();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAutomation]);

  const saveAutomation = useCallback(async () => {
    if (!isHydrated) return false;
    const requestId = ++saveRequestId.current;
    const requestVersion = dirtyVersion.current;
    setSyncState("saving");
    try {
      const response = await fetch(
        `/api/twitter-automation/automations${scopeSearchParams}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(serializeCombinations(combinations)),
        },
      );
      if (!response.ok)
        throw await readAutomationError(
          response,
          "Automation state could not be saved.",
        );
      if (requestId === saveRequestId.current) {
        if (requestVersion === dirtyVersion.current) {
          savedVersion.current = requestVersion;
          setCombinations((current) =>
            current.map((combination) => ({ ...combination, saved: true })),
          );
          setSyncState("saved");
        } else {
          setSyncState("saving");
        }
      }
      return true;
    } catch (error) {
      if (requestId === saveRequestId.current) setSyncState("error");
      showMessage(
        error instanceof Error
          ? error.message
          : "Automation state could not be saved.",
        "error",
      );
      return false;
    }
  }, [combinations, isHydrated, scopeSearchParams, showMessage]);

  useEffect(() => {
    if (!isHydrated || savedVersion.current === dirtyVersion.current) return;
    pendingAutoSaveTimeout.current = window.setTimeout(() => {
      pendingAutoSaveTimeout.current = null;
      void saveAutomation();
    }, 650);
    return () => {
      if (pendingAutoSaveTimeout.current !== null) {
        window.clearTimeout(pendingAutoSaveTimeout.current);
        pendingAutoSaveTimeout.current = null;
      }
    };
  }, [combinations, isHydrated, saveAutomation]);

  useEffect(() => {
    if (!isGeneratedPostsOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsGeneratedPostsOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isGeneratedPostsOpen]);

  function updateCombination(id: string, update: Partial<LanguageCombination>) {
    markDirty();
    setCombinations((current) =>
      current.map((combination) =>
        combination.id === id
          ? { ...combination, ...update, saved: false }
          : combination,
      ),
    );
  }

  function updateDailyQuantity(
    id: string,
    contentType: AutomationContentType,
    quantity: number,
  ) {
    const combination = combinations.find((candidate) => candidate.id === id);
    if (!combination) return;
    updateCombination(id, {
      dailyQuantities: {
        ...combination.dailyQuantities,
        [contentType]: quantity,
      },
    });
  }

  function togglePoolType(id: string, contentType: AutomationContentType) {
    const combination = combinations.find((candidate) => candidate.id === id);
    if (!combination) return;
    updateDailyQuantity(
      id,
      contentType,
      combination.dailyQuantities[contentType] > 0 ? 0 : 1,
    );
  }

  function updateGenerator(
    id: string,
    contentType: AutomationContentType,
    generator: string,
  ) {
    const combination = combinations.find((candidate) => candidate.id === id);
    if (!combination) return;
    updateCombination(id, {
      generators: { ...combination.generators, [contentType]: generator },
      randomIncludes:
        generator === RANDOM_GENERATOR
          ? {
              ...combination.randomIncludes,
              [contentType]: normalizeRandomIncludes(
                contentType,
                combination.randomIncludes[contentType],
              ),
            }
          : combination.randomIncludes,
    });
  }

  function toggleInclude(
    id: string,
    contentType: AutomationContentType,
    include: string,
  ) {
    const combination = combinations.find((candidate) => candidate.id === id);
    if (!combination) return;
    const selected = normalizeRandomIncludes(
      contentType,
      combination.randomIncludes[contentType],
    ) as string[];
    const next = selected.includes(include)
      ? selected.filter((item) => item !== include)
      : [...selected, include];
    if (next.length)
      updateCombination(id, {
        randomIncludes: { ...combination.randomIncludes, [contentType]: next },
      });
  }

  function toggleAccountType(
    id: string,
    accountId: string,
    contentType: AutomationContentType,
  ) {
    const combination = combinations.find((candidate) => candidate.id === id);
    const account = combination?.accounts.find(
      (candidate) => candidate.id === accountId,
    );
    if (
      !combination ||
      !account ||
      !supportedUploadPostContentTypes(account.platform).includes(contentType)
    )
      return;
    const selected = combination.accountContentTypes[accountId] ?? [];
    const next = selected.includes(contentType)
      ? selected.filter((item) => item !== contentType)
      : [...selected, contentType];
    updateCombination(id, {
      accountContentTypes: {
        ...combination.accountContentTypes,
        [accountId]: next,
      },
    });
  }

  function moveAccount(
    id: string,
    accountId: string,
    field: "nativeLanguage" | "language",
    value: LanguageSelection,
  ) {
    const source = combinations.find((candidate) => candidate.id === id);
    const account = source?.accounts.find(
      (candidate) => candidate.id === accountId,
    );
    if (!source || !account || source[field] === value) return;
    const nextNativeLanguage =
      field === "nativeLanguage" ? value : source.nativeLanguage;
    const nextLanguage = field === "language" ? value : source.language;
    const selectedTypes = source.accountContentTypes[accountId] ?? [];
    const target = combinations.find(
      (candidate) =>
        candidate.id !== id &&
        comboKey(candidate.nativeLanguage, candidate.language) ===
          comboKey(nextNativeLanguage, nextLanguage),
    );
    markDirty();
    setCombinations((current) => {
      const sourceCurrent = current.find((candidate) => candidate.id === id);
      if (!sourceCurrent) return current;
      const remainingAccounts = sourceCurrent.accounts.filter(
        (candidate) => candidate.id !== accountId,
      );
      const sourceUpdated = {
        ...sourceCurrent,
        accounts: remainingAccounts,
        accountContentTypes: { ...sourceCurrent.accountContentTypes },
      };
      delete sourceUpdated.accountContentTypes[accountId];
      if (target) {
        return current
          .filter(
            (candidate) => candidate.id !== id || remainingAccounts.length > 0,
          )
          .map((candidate) =>
            candidate.id === id
              ? { ...sourceUpdated, saved: false }
              : candidate.id === target.id
                ? {
                    ...candidate,
                    accounts: [...candidate.accounts, account],
                    accountContentTypes: {
                      ...candidate.accountContentTypes,
                      [accountId]: selectedTypes,
                    },
                    saved: false,
                  }
                : candidate,
          );
      }
      const newCombination: LanguageCombination = {
        ...sourceCurrent,
        id: crypto.randomUUID(),
        nativeLanguage: nextNativeLanguage,
        language: nextLanguage,
        accounts: [account],
        accountContentTypes: { [accountId]: selectedTypes },
        saved: false,
      };
      const withoutAccount = current
        .filter(
          (candidate) => candidate.id !== id || remainingAccounts.length > 0,
        )
        .map((candidate) =>
          candidate.id === id ? { ...sourceUpdated, saved: false } : candidate,
        );
      const sourceIndex = current.findIndex((candidate) => candidate.id === id);
      withoutAccount.splice(
        Math.min(sourceIndex + 1, withoutAccount.length),
        0,
        newCombination,
      );
      return withoutAccount;
    });
  }

  async function scheduleAutomation(horizonDays: 1 | 3 | 7) {
    if (!isHydrated || schedulingHorizon || !activeOutputCount) return;
    unlockMusicVideoAudio();
    setSchedulingHorizon(horizonDays);
    try {
      const saved = await saveAutomation();
      if (!saved)
        throw new Error("The current automation table could not be saved.");
      const response = await fetch("/api/twitter-automation/automation-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ horizonDays, scope: "production" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        errorCode?: string;
        run?: { id?: string };
      } | null;
      if (!response.ok || !payload?.run?.id)
        throw new Error(
          payload?.errorCode === "automation_targets_missing"
            ? "Select at least one account for each platform."
            : "The automation run could not be created.",
        );
      setActiveRunId(payload.run.id);
      setIsGeneratedPostsOpen(true);
    } catch (error) {
      setSyncState("error");
      showMessage(
        error instanceof Error
          ? error.message
          : "The automation run could not be created.",
        "error",
      );
    } finally {
      setSchedulingHorizon(null);
    }
  }

  const statusText =
    syncState === "loading"
      ? "Loading automation"
      : syncState === "saving"
        ? "Saving to Supabase"
        : syncState === "error"
          ? "Save failed"
          : "Saved to Supabase";

  return (
    <section className="content-automation-shell flex h-full min-h-0 flex-col overflow-hidden bg-[#f2f6f1] text-[#17291f]">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#d8e3da] bg-white px-3 py-2 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button
            aria-label="Back to Content Automation"
            className="size-8 shrink-0 rounded-md border-transparent bg-[#eef4ef] p-0 text-[#2f7251] hover:bg-[#e2eee5]"
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Content Automation</p>
            <p className="hidden truncate text-[11px] text-[#7a897f] sm:block">
              Language combination pools
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-xs text-[#75847a] md:flex">
          <span
            className={cn(
              "size-2 rounded-full",
              syncState === "error"
                ? "bg-[#d94d5c]"
                : syncState === "saving" || syncState === "loading"
                  ? "bg-[#d69d21]"
                  : "bg-[#35a363]",
            )}
          />
          {statusText}
        </div>
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto">
          <Button
            aria-label="Refresh automation table"
            className="size-8 shrink-0 rounded-md border-transparent bg-[#2563eb] p-0 text-white hover:bg-[#1d4ed8] disabled:opacity-45"
            disabled={syncState === "loading" || syncState === "saving"}
            onClick={() => void loadAutomation()}
            type="button"
          >
            <RefreshCw
              className={cn(
                "size-4",
                syncState === "loading" && "animate-spin",
              )}
            />
          </Button>
          <Button
            aria-label="Save entire automation table"
            className="h-8 shrink-0 rounded-md border-transparent bg-[#168b51] px-3 text-xs text-white hover:bg-[#117342] disabled:opacity-45"
            disabled={!isHydrated || syncState === "saving"}
            onClick={() => void saveAutomation()}
            type="button"
          >
            <Save className="size-3.5" />
            Save
          </Button>
          <Button
            className="h-8 shrink-0 rounded-md border-transparent bg-[#c026d3] px-3 text-xs text-white hover:bg-[#a21caf] disabled:opacity-45"
            disabled={!activeRunId}
            onClick={() => {
              unlockMusicVideoAudio();
              setIsGeneratedPostsOpen(true);
            }}
            type="button"
          >
            <Sparkles className="size-3.5" />
            Generated posts
          </Button>
          {[
            { days: 1 as const, label: "1 day", color: "#2563eb" },
            { days: 3 as const, label: "3 days", color: "#9333ea" },
            { days: 7 as const, label: "1 week", color: "#ea580c" },
          ].map((option) => (
            <Button
              className="h-8 shrink-0 rounded-md border-transparent bg-[#111111] px-3 text-xs hover:bg-[#272727] disabled:opacity-45"
              disabled={
                !isHydrated || !activeOutputCount || schedulingHorizon !== null
              }
              key={option.days}
              onClick={() => void scheduleAutomation(option.days)}
              style={{ color: option.color }}
              type="button"
            >
              <CalendarPlus className="size-3.5" />
              {schedulingHorizon === option.days ? "Preparing…" : option.label}
            </Button>
          ))}
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1800px] space-y-5 p-4 sm:p-6">
          <section className="overflow-hidden rounded-xl bg-[#2563eb] text-white">
            <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_1fr] lg:p-7">
              <div>
                <div className="flex items-center gap-2 text-[#b9e6c7]">
                  <Layers3 aria-hidden="true" className="size-4" />
                  <span className="text-xs font-semibold">
                    Language combination publishing
                  </span>
                </div>
                <h1 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
                  One pool. Every matching account.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d4edda]">
                  Generate text, image, and video once per language combination,
                  then route each selected type to every matching social
                  account.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                <div className="rounded-lg bg-white p-3 text-black">
                  <span className="text-[11px] text-black/70">
                    Combinations
                  </span>
                  <strong className="mt-1 block text-2xl font-semibold text-black">
                    {combinations.length}
                  </strong>
                </div>
                <div className="rounded-lg bg-white p-3 text-black">
                  <span className="text-[11px] text-black/70">Accounts</span>
                  <strong className="mt-1 block text-2xl font-semibold text-black">
                    {accountCount}
                  </strong>
                </div>
                <div className="rounded-lg bg-white p-3 text-black">
                  <span className="text-[11px] text-black/70">
                    Generated outputs
                  </span>
                  <strong className="mt-1 block text-2xl font-semibold text-black">
                    {activeOutputCount}
                    <span className="ml-1 text-xs font-normal text-black/70">
                      /day
                    </span>
                  </strong>
                </div>
                <div className="rounded-lg bg-white p-3 text-black">
                  <span className="text-[11px] text-black/70">Platforms</span>
                  <strong className="mt-1 block text-2xl font-semibold text-black">
                    {platformCount}
                  </strong>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 lg:col-span-2">
                  {CONTENT_TYPE_META.map(({ value, label, icon: Icon }) => (
                    <div
                      className="rounded-lg bg-white p-3 text-black"
                      key={value}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-black/70">
                        <Icon aria-hidden="true" className="size-3.5" />
                        {label}
                      </div>
                      <strong className="mt-1 block text-xl font-semibold text-black">
                        {dailyContentCounts[value]}
                        <span className="ml-1 text-xs font-normal text-black/60">
                          /day
                        </span>
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="mt-2 lg:col-span-2">
                  <div className="rounded-md bg-white p-3 text-black">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-black/70">
                        Estimated cost
                      </span>
                      <span className="text-[10px] text-black/60">
                        Only assigned types
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[10px] text-black/60">
                          Daily
                        </span>
                        <strong className="mt-0.5 block text-sm font-semibold text-black">
                          {formatAutomationCostTry(totalCost.oneOffTry)}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-black/60">
                          Monthly
                        </span>
                        <strong className="mt-0.5 block text-sm font-semibold text-black">
                          {formatAutomationCostTry(totalCost.monthlyTry)}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 bg-black/10 px-5 py-3 text-xs text-[#d4edda] lg:px-7">
              <Info aria-hidden="true" className="size-4 shrink-0" />
              {configuredOutputCount > activeOutputCount
                ? `${configuredOutputCount - activeOutputCount} output${configuredOutputCount - activeOutputCount === 1 ? " is" : "s are"} disabled because no account selected that type.`
                : "Each generated item is shared across every account selected for its content type."}
            </div>
          </section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[#17291f]">
                Language combinations
              </h2>
              <p className="mt-1 text-sm text-[#718077]">
                Configure one media pool, then choose its delivery types per
                account.
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#69796f] shadow-sm">
              <Clock3 aria-hidden="true" className="size-3.5 text-[#2f7251]" />
              Automatic window: 11:00–23:00
            </div>
          </div>
          {!isHydrated ? (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-[#cbd9ce] bg-white text-sm text-[#7a897f]">
              Loading social media accounts…
            </div>
          ) : !combinations.length ? (
            <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-[#cbd9ce] bg-white text-sm text-[#b24c58]">
              No non-email social media accounts are available.
            </div>
          ) : (
            <div className="space-y-5">
              {combinations.map((combination, index) => (
                <CombinationCard
                  combination={combination}
                  color={COMBO_COLORS[index % COMBO_COLORS.length]!}
                  key={combination.id}
                  onGeneratorChange={(contentType, generator) =>
                    updateGenerator(combination.id, contentType, generator)
                  }
                  onLanguageChange={(accountId, field, value) =>
                    moveAccount(combination.id, accountId, field, value)
                  }
                  onQuantityChange={(contentType, quantity) =>
                    updateDailyQuantity(combination.id, contentType, quantity)
                  }
                  onToggleAccountType={(accountId, contentType) =>
                    toggleAccountType(combination.id, accountId, contentType)
                  }
                  onToggleInclude={(contentType, include) =>
                    toggleInclude(combination.id, contentType, include)
                  }
                  onTogglePoolType={(contentType) =>
                    togglePoolType(combination.id, contentType)
                  }
                  onUpdate={(update) =>
                    updateCombination(combination.id, update)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <footer className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#d8e3da] bg-white px-4 py-2 text-xs text-[#75847a] sm:px-6">
        <span>
          Each pool generates once, then publishes to every selected account.
        </span>
        <span className="font-semibold text-[#2f7251]">
          {activeOutputCount} generated outputs/day · {accountCount} accounts
        </span>
      </footer>
      {isGeneratedPostsOpen && activeRunId
        ? createPortal(
            <div
              aria-label="Generated posts"
              aria-modal="true"
              className="fixed inset-0 z-[9999] grid place-items-center overscroll-contain bg-black/45 p-4"
              aria-labelledby={`automation-run-${activeRunId}-title`}
              role="dialog"
            >
              <GeneratedPostsTable
                onClose={() => setIsGeneratedPostsOpen(false)}
                runId={activeRunId}
                scope="production"
              />
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
