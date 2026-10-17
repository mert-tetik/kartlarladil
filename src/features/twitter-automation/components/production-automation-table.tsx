"use client";

import { ArrowLeft, ArrowRight, CalendarPlus, ChevronDown, Clock3, FileText, Globe2, ImageIcon, Info, Layers3, LockKeyhole, RefreshCw, Save, Sparkles, Video } from "lucide-react";
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
import { AUTOMATION_GENERATOR_OPTIONS, RANDOM_GENERATOR, RANDOM_INCLUDE_OPTIONS, normalizeRandomIncludes, type AutomationContentType } from "@/features/twitter-automation/automation-randomization";
import { estimateAutomationGroupCost, formatAutomationCostTry, type AutomationCostRow } from "@/features/twitter-automation/automation-cost-estimates";
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

type RecipeSettings = {
  contentTypes: AutomationContentType[];
  generators: Partial<Record<AutomationContentType, string>>;
  randomIncludes: Partial<Record<AutomationContentType, string[]>>;
  quantity: number;
  language: LanguageSelection;
  nativeLanguage: LanguageSelection;
  tier: TierSelection;
};

type PlatformRecipe = RecipeSettings & {
  id: string;
  platform: Platform;
  platformLabel: string;
  accountName: string;
  accountIds: string[];
  linkedRecipeId: string | null;
  ownSettings: RecipeSettings | null;
  saved: boolean;
};

type StoredAutomationRow = Partial<PlatformRecipe> & {
  contentType?: "random" | AutomationContentType;
  generator?: string;
  platforms?: string[];
  accounts?: Record<string, string[]>;
  scheduleStart?: string;
  scheduleEnd?: string;
  settingsSourceAccountId?: string;
  settingsByAccount?: Record<string, RecipeSettings>;
};

type StoredAutomationGroup = { rows?: StoredAutomationRow[] };

const CONTENT_TYPES: Array<{ value: AutomationContentType; label: string; icon: typeof FileText }> = [
  { value: "text", label: "Text", icon: FileText },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video },
];
const QUANTITY_OPTIONS = Array.from({ length: 20 }, (_, index) => index + 1);
const FIXED_SCHEDULE_START = "11:00";
const FIXED_SCHEDULE_END = "23:00";
const SHARED_POOL_GROUP_ID = "c8e24d58-0d1d-4bc0-9c9a-7df4f7bd4a21";
const CONTROL_CLASS = "h-10 w-full rounded-md border border-[#dce6df] bg-white px-3 text-sm font-medium text-[#1b2a21] outline-none transition focus:border-[#2f7251] focus:ring-2 focus:ring-[#2f7251]/15";
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
  return PLATFORM_COLORS[platform] ?? ["#6d28d9", "#0891b2", "#ea580c", "#15803d"][index % 4]!;
}

const LANGUAGE_GROUP_COLORS = ["#2563eb", "#d62976", "#0f766e", "#ea580c", "#7c3aed", "#dc2626", "#0891b2", "#15803d"];

type LanguageRecipeGroup = {
  key: string;
  nativeLanguage: LanguageSelection;
  learningLanguage: LanguageSelection;
  recipes: PlatformRecipe[];
};

function languageSelectionLabel(value: LanguageSelection) {
  return value === "random" ? "Random" : LANGUAGE_BY_CODE[value]?.name ?? value;
}

function languageCombinationKey(recipe: PlatformRecipe) {
  return `${recipe.nativeLanguage}->${recipe.language}`;
}

function groupRecipesByLanguage(recipes: readonly PlatformRecipe[]) {
  const groups = new Map<string, LanguageRecipeGroup>();
  for (const recipe of recipes) {
    const key = languageCombinationKey(recipe);
    const group = groups.get(key) ?? {
      key,
      nativeLanguage: recipe.nativeLanguage,
      learningLanguage: recipe.language,
      recipes: [],
    };
    group.recipes.push(recipe);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function recipeSettings(recipe: PlatformRecipe): RecipeSettings {
  return {
    contentTypes: [...recipe.contentTypes],
    generators: { ...recipe.generators },
    randomIncludes: { ...recipe.randomIncludes },
    quantity: recipe.quantity,
    language: recipe.language,
    nativeLanguage: recipe.nativeLanguage,
    tier: recipe.tier,
  };
}

function recipeWithSettings(recipe: PlatformRecipe, settings: RecipeSettings): PlatformRecipe {
  return {
    ...recipe,
    contentTypes: [...settings.contentTypes],
    generators: { ...settings.generators },
    randomIncludes: { ...settings.randomIncludes },
    quantity: settings.quantity,
    language: settings.language,
    nativeLanguage: settings.nativeLanguage,
    tier: settings.tier,
  };
}

function recipeAccountId(recipe: PlatformRecipe) {
  return recipe.accountIds[0] ?? recipe.id;
}

function settingsCompatibleWithAccount(settings: RecipeSettings, account: PlatformRecipe) {
  const supported = new Set(supportedUploadPostContentTypes(account.platform));
  return settings.contentTypes.length > 0 && settings.contentTypes.every((contentType) => supported.has(contentType));
}

function makeDefaultRecipe(account: SocialMediaAccount, existing?: StoredAutomationRow): PlatformRecipe {
  const supportedContentTypes = supportedUploadPostContentTypes(account.platform);
  const selectedContentTypes = existing?.contentTypes?.filter((type): type is AutomationContentType => (type === "text" || type === "image" || type === "video") && supportedContentTypes.includes(type)) ?? [];
  const contentTypes: AutomationContentType[] = selectedContentTypes.length
    ? [...new Set(selectedContentTypes)]
    : supportedContentTypes.length && (existing?.contentType === "text" || existing?.contentType === "image" || existing?.contentType === "video") && supportedContentTypes.includes(existing.contentType)
      ? [existing.contentType]
      : supportedContentTypes.length ? [supportedContentTypes[0]!] : [];
  const generators: Partial<Record<AutomationContentType, string>> = { ...existing?.generators };
  for (const contentType of contentTypes) {
    generators[contentType] = generators[contentType] ?? (contentTypes.length === 1 && existing?.generator ? existing.generator : RANDOM_GENERATOR);
  }
  const randomIncludes: Partial<Record<AutomationContentType, string[]>> = { ...existing?.randomIncludes };
  for (const contentType of contentTypes) randomIncludes[contentType] = normalizeRandomIncludes(contentType, randomIncludes[contentType]);

  const existingAccountIds = existing?.accounts?.[account.platform] ?? existing?.accountIds ?? [];
  const canKeepExistingId = existing?.id && existing?.platforms?.length === 1 && existingAccountIds.length === 1 && existingAccountIds[0] === account.id;

  return {
    id: canKeepExistingId ? existing.id! : crypto.randomUUID(),
    platform: account.platform,
    platformLabel: account.platformLabel,
    accountName: account.accountName,
    accountIds: [account.id],
    contentTypes,
    generators,
    randomIncludes,
    quantity: Number.isInteger(existing?.quantity) ? Math.min(20, Math.max(1, existing?.quantity ?? 1)) : 1,
    language: existing?.language === "random" ? "random" : existing?.language && existing.language in LANGUAGE_BY_CODE ? existing.language : "en",
    nativeLanguage: existing?.nativeLanguage === "random" ? "random" : existing?.nativeLanguage && existing.nativeLanguage in LANGUAGE_BY_CODE ? existing.nativeLanguage : "en",
    tier: existing?.tier === "random" ? "random" : existing?.tier && TIERS.includes(existing.tier as Tier) ? existing.tier as Tier : "random",
    linkedRecipeId: null,
    ownSettings: null,
    saved: true,
  };
}

function hydrateRecipes(accounts: SocialMediaAccount[], groups: StoredAutomationGroup[] | undefined) {
  const oldRows = (groups ?? []).flatMap((group) => group.rows ?? []);
  return [...accounts]
    .sort((first, second) => first.platformLabel.localeCompare(second.platformLabel) || first.accountName.localeCompare(second.accountName))
    .map((account) => {
      const existing = oldRows.find((row) => row.accounts?.[account.platform]?.includes(account.id) || row.accountIds?.includes(account.id));
      const recipe = makeDefaultRecipe(account, existing);
      const storedAccountIds = existing ? Object.values(existing.accounts ?? {}).flat() : [];
      const sourceAccountId = existing?.settingsSourceAccountId ?? storedAccountIds[0] ?? account.id;
      const storedOwnSettings = existing?.settingsByAccount?.[account.id];
      return {
        ...recipe,
        linkedRecipeId: sourceAccountId !== account.id ? sourceAccountId : null,
        ownSettings: sourceAccountId !== account.id ? storedOwnSettings ?? recipeSettings(recipe) : null,
      };
    });
}

function serializeRecipes(recipes: readonly PlatformRecipe[]) {
  const linkedGroups = linkedRecipeGroups(recipes);
  return {
    groups: [{
      id: SHARED_POOL_GROUP_ID,
      name: "Linked content groups",
      tone: "emerald",
      color: "#2f7251",
      icon: "youtube",
      collapsed: false,
      rows: linkedGroups.map(({ source, members }) => {
        const accounts = members.reduce<Record<string, string[]>>((result, member) => ({ ...result, [member.platform]: [...(result[member.platform] ?? []), ...member.accountIds] }), {});
        const settingsByAccount = Object.fromEntries(members.map((member) => [recipeAccountId(member), recipeSettings(member)]));
        return {
          id: source.id,
          contentType: source.contentTypes.length === 1 ? source.contentTypes[0] : "random",
          generator: source.contentTypes.length === 1 ? source.generators[source.contentTypes[0]] ?? RANDOM_GENERATOR : "random-content",
          contentTypes: source.contentTypes,
          generators: source.generators,
          randomIncludes: source.randomIncludes,
          quantity: source.quantity,
          language: source.language,
          nativeLanguage: source.nativeLanguage,
          tier: source.tier,
          platforms: [...new Set(members.map((member) => member.platform))],
          accounts,
          settingsSourceAccountId: recipeAccountId(source),
          settingsByAccount,
          scheduleStart: FIXED_SCHEDULE_START,
          scheduleEnd: FIXED_SCHEDULE_END,
          saved: true,
        };
      }),
    }],
    superGroups: [],
  };
}

function resolveRecipeSource(recipes: readonly PlatformRecipe[], recipe: PlatformRecipe) {
  const byAccountId = new Map(recipes.map((recipe) => [recipeAccountId(recipe), recipe]));
  let source = recipe;
  const visited = new Set<string>();
  while (source.linkedRecipeId && !visited.has(source.linkedRecipeId)) {
    visited.add(source.linkedRecipeId);
    const nextSource = byAccountId.get(source.linkedRecipeId);
    if (!nextSource) break;
    source = nextSource;
  }
  return source;
}

function linkedRecipeGroups(recipes: readonly PlatformRecipe[]) {
  const groups = new Map<string, { source: PlatformRecipe; members: PlatformRecipe[] }>();
  for (const recipe of recipes) {
    if (!recipe.contentTypes.length) continue;
    const source = resolveRecipeSource(recipes, recipe);
    if (!settingsCompatibleWithAccount(source, recipe)) continue;
    const key = recipeAccountId(source);
    const group = groups.get(key) ?? { source, members: [] };
    if (!group.members.some((member) => recipeAccountId(member) === recipeAccountId(recipe))) group.members.push(recipe);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function hasRecipeSettingsUpdate(update: Partial<PlatformRecipe>) {
  return ["contentTypes", "generators", "randomIncludes", "quantity", "language", "nativeLanguage", "tier"].some((key) => key in update);
}

function settingsFromRecipe(recipe: PlatformRecipe) {
  return recipeSettings(recipe);
}

function linkedGenerationCount(recipes: readonly PlatformRecipe[]) {
  return linkedRecipeGroups(recipes).reduce((total, group) => total + group.source.quantity, 0);
}

function toAutomationCostRow(recipe: PlatformRecipe): AutomationCostRow {
  const singleContentType = recipe.contentTypes.length === 1 ? recipe.contentTypes[0]! : null;
  return {
    contentType: singleContentType ?? "random",
    generator: singleContentType ? recipe.generators[singleContentType] ?? RANDOM_GENERATOR : "random-content",
    contentTypes: recipe.contentTypes,
    generators: recipe.generators,
    randomIncludes: recipe.randomIncludes as AutomationCostRow["randomIncludes"],
    quantity: recipe.quantity,
  };
}

function RecipeCostSummary({ recipe, prominent = false, linked = false }: { recipe: PlatformRecipe; prominent?: boolean; linked?: boolean }) {
  const estimate = linked ? null : estimateAutomationGroupCost([toAutomationCostRow(recipe)]);
  return <div className={cn("rounded-md p-3", prominent ? "bg-white/15 text-white" : "bg-[#edf3ef] text-[#253a2c]")}>
    <div className="flex items-center justify-between gap-2">
      <span className={cn("text-[11px] font-semibold", prominent ? "text-white/75" : "text-[#53665a]")}>{linked ? "Linked generation" : "Estimated cost"}</span>
      <span className={cn("text-[10px]", prominent ? "text-white/65" : "text-[#7b8b80]" )}>AI generation</span>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <div>
        <span className={cn("block text-[10px]", prominent ? "text-white/70" : "text-[#7b8b80]" )}>Daily</span>
        <strong className="mt-0.5 block text-sm font-semibold">{linked ? "Shared" : formatAutomationCostTry(estimate!.oneOffTry)}</strong>
      </div>
      <div>
        <span className={cn("block text-[10px]", prominent ? "text-white/70" : "text-[#7b8b80]" )}>Monthly</span>
        <strong className="mt-0.5 block text-sm font-semibold">{linked ? "Shared" : formatAutomationCostTry(estimate!.monthlyTry)}</strong>
      </div>
    </div>
  </div>;
}

function PlatformGlyph({ platform, color, size = "size-8" }: { platform: string; color: string; size?: string }) {
  const iconPath = PLATFORM_ICON_PATHS[platform];
  if (iconPath) return <span className={cn("grid shrink-0 place-items-center rounded-md", size)} style={{ backgroundColor: color }}><Image alt="" aria-hidden="true" className="size-5 object-contain brightness-0 invert" height={20} src={iconPath} unoptimized width={20} /></span>;
  return <span className={cn("grid shrink-0 place-items-center rounded-md text-white", size)} style={{ backgroundColor: color }}><Globe2 aria-hidden="true" className="size-5" /></span>;
}

function LanguageSelect({ label, value, onChange, disabled = false }: { label: string; value: LanguageSelection; onChange: (value: LanguageSelection) => void; disabled?: boolean }) {
  const selected = value !== "random" ? LANGUAGE_BY_CODE[value] : null;
  return <label className="min-w-0 space-y-1.5"><span className="block text-[11px] font-semibold text-[#6f7f75]">{label}</span><div className="relative"><select aria-label={label} className={cn(CONTROL_CLASS, "appearance-none pl-3 pr-8", disabled && "cursor-not-allowed bg-[#f4f6f4] text-[#8d9991]")} disabled={disabled} onChange={(event) => onChange(event.target.value as LanguageSelection)} value={value}><option value="random">Random</option>{Object.values(LANGUAGE_BY_CODE).map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}</select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[#809087]" />{selected ? <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-[#809087]">{selected.code.toUpperCase()}</span> : null}</div></label>;
}

function GeneratorControl({ recipe, contentType, onChange, onToggleInclude, disabled = false }: { recipe: PlatformRecipe; contentType: AutomationContentType; onChange: (generator: string) => void; onToggleInclude: (include: string) => void; disabled?: boolean }) {
  const generator = recipe.generators[contentType] ?? RANDOM_GENERATOR;
  const includeOptions = RANDOM_INCLUDE_OPTIONS[contentType];
  const includes = normalizeRandomIncludes(contentType, recipe.randomIncludes[contentType]);
  return <div className="space-y-2"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-[#6f7f75]">{CONTENT_TYPES.find((item) => item.value === contentType)?.label} generator</span>{generator === RANDOM_GENERATOR ? <span className="rounded-full bg-[#edf4ef] px-2 py-0.5 text-[10px] font-semibold text-[#2f7251]">Pool random</span> : null}</div><select aria-label={`${contentType} generator`} className={cn(CONTROL_CLASS, disabled && "cursor-not-allowed bg-[#f4f6f4] text-[#8d9991]")} disabled={disabled} onChange={(event) => onChange(event.target.value)} value={generator}>{AUTOMATION_GENERATOR_OPTIONS[contentType].map((option) => <option key={option.value} value={option.value}>{option.source ? `${option.label} · ${option.source}` : option.label}</option>)}</select>{generator === RANDOM_GENERATOR ? <div className="flex flex-wrap gap-1.5">{includeOptions.map((option) => { const selected = includes.includes(option.value); return <label className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition", disabled && "cursor-not-allowed opacity-60", selected ? "border-[#2f7251]/25 bg-[#e4f1e7] text-[#2f7251]" : "border-[#dce6df] bg-white text-[#85948b]")} key={option.value}><input aria-label={`${contentType} include ${option.label}`} checked={selected} className="size-3.5 accent-[#2f7251]" disabled={disabled} onChange={() => onToggleInclude(option.value)} type="checkbox" />{option.label}</label>; })}</div> : null}</div>;
}

function AccountRecipeCard({ recipe, index, onChange, expanded, onToggleExpanded, linkOptions, onLinkChange, allowedContentTypes }: { recipe: PlatformRecipe; index: number; onChange: (update: Partial<PlatformRecipe>) => void; expanded: boolean; onToggleExpanded: () => void; linkOptions: Array<{ id: string; label: string; disabled: boolean }>; onLinkChange: (linkedRecipeId: string | null) => void; allowedContentTypes: readonly AutomationContentType[] }) {
  const color = platformColor(recipe.platform, index);
  const supportedContentTypes = supportedUploadPostContentTypes(recipe.platform);
  const settingsLocked = Boolean(recipe.linkedRecipeId);
  const toggleContentType = (contentType: AutomationContentType) => {
    if (settingsLocked || !allowedContentTypes.includes(contentType)) return;
    const nextTypes = recipe.contentTypes.includes(contentType) ? recipe.contentTypes.filter((item) => item !== contentType) : [...recipe.contentTypes, contentType];
    if (!nextTypes.length) return;
    onChange({ contentTypes: nextTypes, generators: { ...recipe.generators, [contentType]: recipe.generators[contentType] ?? RANDOM_GENERATOR }, randomIncludes: { ...recipe.randomIncludes, [contentType]: normalizeRandomIncludes(contentType, recipe.randomIncludes[contentType]) }, saved: false });
  };
  const updateGenerator = (contentType: AutomationContentType, generator: string) => onChange({ generators: { ...recipe.generators, [contentType]: generator }, randomIncludes: generator === RANDOM_GENERATOR ? { ...recipe.randomIncludes, [contentType]: normalizeRandomIncludes(contentType, recipe.randomIncludes[contentType]) } : recipe.randomIncludes, saved: false });
  const toggleInclude = (contentType: AutomationContentType, include: string) => {
    const selected = normalizeRandomIncludes(contentType, recipe.randomIncludes[contentType]) as string[];
    const next = selected.includes(include) ? selected.filter((item) => item !== include) : [...selected, include];
    if (next.length) onChange({ randomIncludes: { ...recipe.randomIncludes, [contentType]: next }, saved: false });
  };

  return <article className="overflow-hidden rounded-xl border border-[#dbe5dd] bg-white shadow-sm"><button aria-expanded={expanded} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[#f7faf7] sm:p-5" onClick={onToggleExpanded} type="button"><PlatformGlyph color={color} platform={recipe.platform} size="size-11" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-base font-semibold text-[#15271d] sm:text-lg">{recipe.accountName}</h3><span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: color }}>{recipe.platformLabel}</span></div><p className="mt-1 text-xs text-[#75847b]">{recipe.contentTypes.map((type) => CONTENT_TYPES.find((item) => item.value === type)?.label).join(" · ")} · {recipe.quantity} içerik/gün · 11:00–23:00</p></div><span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", recipe.saved ? "bg-[#e6f4ea] text-[#237446]" : "bg-[#fff4d8] text-[#9a6a0a]")}><span className={cn("size-1.5 rounded-full", recipe.saved ? "bg-[#2f9b5f]" : "bg-[#d39a21]")} />{recipe.saved ? "Saved" : "Draft"}</span><ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-[#718077] transition-transform", expanded && "rotate-180")} /></button>{expanded ? <div className="border-t border-[#e3ebe3] p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-sm font-semibold text-[#17291f]">Generation settings</h4><p className="mt-0.5 text-xs text-[#718077]">Settings for {recipe.accountName} only.</p></div><span className="text-xs font-medium text-[#718077]">Automatic publish window · 11:00–23:00</span></div><div className="mb-4 flex flex-wrap items-end justify-between gap-3"><label className="min-w-56 space-y-1.5"><span className="block text-[11px] font-semibold text-[#6f7f75]">Use settings from</span><select aria-label={`${recipe.accountName} settings source`} className={cn(CONTROL_CLASS, "text-sm", settingsLocked && "border-[#2f7251]/35 bg-[#f2f8f3]")} onChange={(event) => onLinkChange(event.target.value || null)} value={recipe.linkedRecipeId ?? ""}><option value="">Own settings</option>{linkOptions.map((option) => <option disabled={option.disabled} key={option.id} value={option.id}>{option.label}{option.disabled ? " · incompatible" : ""}</option>)}</select></label>{settingsLocked ? <span className="mb-1 text-xs text-[#587366]">Using linked settings. Select Own settings to edit this account.</span> : <span className="mb-1 text-xs text-[#7b8b80]">Link compatible accounts to generate once and publish everywhere.</span>}</div><div className="grid gap-4 xl:grid-cols-[1.05fr_1.35fr_0.78fr]"><div className="space-y-3"><div><span className="mb-2 block text-[11px] font-semibold text-[#6f7f75]">Content types</span><div className="grid grid-cols-3 gap-1.5">{CONTENT_TYPES.map(({ value, label, icon: Icon }) => { const selected = recipe.contentTypes.includes(value); const supported = supportedContentTypes.includes(value); const allowed = allowedContentTypes.includes(value); const available = allowed && !settingsLocked; return <button aria-pressed={selected} aria-disabled={!available} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border text-xs font-semibold transition", !supported ? "cursor-not-allowed border-[#e7ece8] bg-[#f1f4f1] text-[#a1aaa4]" : !allowed ? "cursor-not-allowed border-[#e3e9e4] bg-[#f7f9f7] text-[#87958b]" : !available ? "cursor-not-allowed border-[#e3e9e4] bg-[#f7f9f7] text-[#87958b]" : selected ? "border-transparent text-white" : "border-[#dce6df] bg-white text-[#77877d] hover:bg-[#f4f8f4]")} disabled={!available} key={value} onClick={() => available && toggleContentType(value)} style={selected && available ? { backgroundColor: color } : undefined} title={!supported ? "Not supported by Upload-Post for this platform" : !allowed ? "Not supported by a linked account" : settingsLocked ? "Choose Own settings to edit this account" : undefined} type="button">{!supported ? <LockKeyhole aria-hidden="true" className="size-3.5" /> : <Icon aria-hidden="true" className="size-4" />}{label}</button>; })}</div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><LanguageSelect label="Learning language" disabled={settingsLocked} onChange={(language) => onChange({ language, saved: false })} value={recipe.language} /><LanguageSelect label="Native language" disabled={settingsLocked} onChange={(nativeLanguage) => onChange({ nativeLanguage, saved: false })} value={recipe.nativeLanguage} /></div></div><div className="space-y-3">{recipe.contentTypes.map((contentType) => <GeneratorControl contentType={contentType} key={contentType} onChange={(generator) => updateGenerator(contentType, generator)} onToggleInclude={(include) => toggleInclude(contentType, include)} recipe={recipe} disabled={settingsLocked} />)}</div><div className="space-y-3"><label className="block space-y-1.5"><span className="text-[11px] font-semibold text-[#6f7f75]">Outputs per day</span><select aria-label={`${recipe.accountName} outputs per day`} className={cn(CONTROL_CLASS, "text-base font-semibold", settingsLocked && "cursor-not-allowed bg-[#f4f6f4] text-[#8d9991]")} disabled={settingsLocked} onChange={(event) => onChange({ quantity: Number(event.target.value), saved: false })} value={recipe.quantity}>{QUANTITY_OPTIONS.map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}</select></label><label className="block space-y-1.5"><span className="text-[11px] font-semibold text-[#6f7f75]">Tier</span><select aria-label={`${recipe.accountName} tier`} className={cn(CONTROL_CLASS, settingsLocked && "cursor-not-allowed bg-[#f4f6f4] text-[#8d9991]")} disabled={settingsLocked} onChange={(event) => onChange({ tier: event.target.value as TierSelection, saved: false })} value={recipe.tier}><option value="random">Random</option>{TIERS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label><RecipeCostSummary linked={settingsLocked} recipe={recipe} /><div className="rounded-md bg-[#edf3ef] p-2.5 text-xs text-[#53665a]"><div className="flex items-center gap-1.5 font-semibold"><Clock3 aria-hidden="true" className="size-3.5 text-[#2f7251]" />11:00–23:00</div><p className="mt-1 text-[10px] leading-4 text-[#7b8b80]">Random publish time · İstanbul</p></div></div></div></div> : null}</article>;
}

async function readAutomationError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { errorCode?: string } | null;
  return new Error(payload?.errorCode ? `${fallback} (${payload.errorCode}).` : fallback);
}

export function ProductionAutomationTable({ onBack }: { onBack: () => void }) {
  const { showMessage } = useAppMessage();
  const [recipes, setRecipes] = useState<PlatformRecipe[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [schedulingHorizon, setSchedulingHorizon] = useState<1 | 3 | 7 | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isGeneratedPostsOpen, setIsGeneratedPostsOpen] = useState(false);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const saveRequestId = useRef(0);
  const pendingAutoSaveTimeout = useRef<number | null>(null);
  const dirtyVersion = useRef(0);
  const savedVersion = useRef(0);
  const scopeSearchParams = automationScopeSearchParams("production");
  const platformCount = useMemo(() => new Set(recipes.map((recipe) => recipe.platform)).size, [recipes]);
  const selectedAccountCount = recipes.length;
  const rawOutputCount = recipes.filter((recipe) => recipe.contentTypes.length > 0).reduce((total, recipe) => total + recipe.quantity, 0);
  const sharedOutputCount = linkedGenerationCount(recipes);
  const linkedCost = useMemo(() => estimateAutomationGroupCost(linkedRecipeGroups(recipes).map((group) => toAutomationCostRow(group.source))), [recipes]);
  const languageGroups = useMemo(() => groupRecipesByLanguage(recipes), [recipes]);

  const loadAutomation = useCallback(async () => {
    setSyncState("loading");
    try {
      const response = await fetch(`/api/twitter-automation/automations${scopeSearchParams}`, { cache: "no-store" });
      if (!response.ok) throw await readAutomationError(response, "Automation state could not be loaded.");
      const payload = await response.json() as { groups?: StoredAutomationGroup[]; socialAccounts?: SocialMediaAccount[] };
      const accounts = Array.isArray(payload.socialAccounts) ? payload.socialAccounts : [];
      const nextRecipes = hydrateRecipes(accounts, Array.isArray(payload.groups) ? payload.groups : []);
      dirtyVersion.current += 1;
      savedVersion.current = dirtyVersion.current;
      setRecipes(nextRecipes);
      setExpandedRecipeId(null);
      setSyncState("saved");
      setIsHydrated(true);
    } catch (error) {
      setSyncState("error");
      showMessage(error instanceof Error ? error.message : "Automation state could not be loaded.", "error");
    }
  }, [scopeSearchParams, showMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAutomation(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAutomation]);

  const saveAutomation = useCallback(async () => {
    if (!isHydrated) return false;
    const requestId = ++saveRequestId.current;
    const requestVersion = dirtyVersion.current;
    setSyncState("saving");
    try {
      const response = await fetch(`/api/twitter-automation/automations${scopeSearchParams}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(serializeRecipes(recipes)) });
      if (!response.ok) throw await readAutomationError(response, "Automation state could not be saved.");
      if (requestId === saveRequestId.current) {
        if (requestVersion === dirtyVersion.current) {
          savedVersion.current = requestVersion;
          setRecipes((current) => current.some((recipe) => !recipe.saved) ? current.map((recipe) => ({ ...recipe, saved: true })) : current);
          setSyncState("saved");
        } else {
          setSyncState("saving");
        }
      }
      return true;
    } catch (error) {
      if (requestId === saveRequestId.current) setSyncState("error");
      showMessage(error instanceof Error ? error.message : "Automation state could not be saved.", "error");
      return false;
    }
  }, [isHydrated, recipes, scopeSearchParams, showMessage]);

  useEffect(() => {
    if (!isHydrated || savedVersion.current === dirtyVersion.current) return;
    pendingAutoSaveTimeout.current = window.setTimeout(() => { pendingAutoSaveTimeout.current = null; void saveAutomation(); }, 650);
    return () => { if (pendingAutoSaveTimeout.current !== null) { window.clearTimeout(pendingAutoSaveTimeout.current); pendingAutoSaveTimeout.current = null; } };
  }, [isHydrated, recipes, saveAutomation]);

  useEffect(() => {
    if (!isGeneratedPostsOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setIsGeneratedPostsOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [isGeneratedPostsOpen]);

  async function scheduleAutomation(horizonDays: 1 | 3 | 7) {
    if (!isHydrated || schedulingHorizon || !sharedOutputCount) return;
    unlockMusicVideoAudio();
    setSchedulingHorizon(horizonDays);
    try {
      const saved = await saveAutomation();
      if (!saved) throw new Error("The current automation table could not be saved.");
      const response = await fetch("/api/twitter-automation/automation-runs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ horizonDays, scope: "production" }) });
      const payload = await response.json().catch(() => null) as { errorCode?: string; run?: { id?: string } } | null;
      if (!response.ok || !payload?.run?.id) throw new Error(payload?.errorCode === "automation_targets_missing" ? "Select at least one account for each platform." : "The automation run could not be created.");
      setActiveRunId(payload.run.id);
      setIsGeneratedPostsOpen(true);
    } catch (error) {
      setSyncState("error");
      showMessage(error instanceof Error ? error.message : "The automation run could not be created.", "error");
    } finally {
      setSchedulingHorizon(null);
    }
  }

  function updateRecipe(recipeId: string, update: Partial<PlatformRecipe>) {
    dirtyVersion.current += 1;
    setRecipes((current) => {
      const target = current.find((recipe) => recipe.id === recipeId);
      if (!target || target.linkedRecipeId) return current;
      const next = current.map((recipe) => recipe.id === recipeId ? { ...recipe, ...update } : recipe);
      if (!hasRecipeSettingsUpdate(update)) return next;
      const source = next.find((recipe) => recipe.id === recipeId);
      if (!source) return next;
      const sourceSettings = settingsFromRecipe(source);
      const sourceAccountId = recipeAccountId(source);
      return next.map((recipe) => recipe.linkedRecipeId === sourceAccountId ? { ...recipe, ...sourceSettings, saved: false } : recipe);
    });
  }

  function updateRecipeLink(recipeId: string, sourceAccountId: string | null) {
    dirtyVersion.current += 1;
    setRecipes((current) => {
      const target = current.find((recipe) => recipe.id === recipeId);
      if (!target) return current;

      if (!sourceAccountId) {
        const restoredSettings = target.ownSettings ?? recipeSettings(target);
        return current.map((recipe) => recipe.id === recipeId ? { ...recipeWithSettings(recipe, restoredSettings), linkedRecipeId: null, ownSettings: null, saved: false } : recipe);
      }

      const selectedSource = current.find((recipe) => recipeAccountId(recipe) === sourceAccountId);
      if (!selectedSource) return current;
      const source = resolveRecipeSource(current, selectedSource);
      if (recipeAccountId(source) === recipeAccountId(target) || !settingsCompatibleWithAccount(source, target)) return current;
      const ownSettings = target.ownSettings ?? recipeSettings(target);
      return current.map((recipe) => recipe.id === recipeId
        ? { ...recipeWithSettings(recipe, recipeSettings(source)), linkedRecipeId: recipeAccountId(source), ownSettings, saved: false }
        : recipe);
    });
  }

  function getAllowedContentTypes(recipe: PlatformRecipe) {
    const linkedTargets = recipes.filter((candidate) => candidate.linkedRecipeId === recipeAccountId(recipe));
    return supportedUploadPostContentTypes(recipe.platform).filter((contentType) => linkedTargets.every((target) => supportedUploadPostContentTypes(target.platform).includes(contentType)));
  }

  function getLinkOptions(recipe: PlatformRecipe) {
    const options: Array<{ id: string; label: string; disabled: boolean }> = [];
    const seen = new Set<string>();
    for (const candidate of recipes) {
      if (candidate.id === recipe.id) continue;
      const source = resolveRecipeSource(recipes, candidate);
      const sourceId = recipeAccountId(source);
      if (seen.has(sourceId) || sourceId === recipeAccountId(recipe)) continue;
      seen.add(sourceId);
      options.push({
        id: sourceId,
        label: `${source.platformLabel} · ${source.accountName}`,
        disabled: !settingsCompatibleWithAccount(source, recipe),
      });
    }
    return options;
  }

  const statusText = syncState === "loading" ? "Loading automation" : syncState === "saving" ? "Saving to Supabase" : syncState === "error" ? "Save failed" : "Saved to Supabase";

  return <section className="content-automation-shell flex h-full min-h-0 flex-col overflow-hidden bg-[#f2f6f1] text-[#17291f]"><header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#d8e3da] bg-white px-3 py-2 sm:px-5"><div className="flex min-w-0 items-center gap-2.5"><Button aria-label="Back to Content Automation" className="size-8 shrink-0 rounded-md border-transparent bg-[#eef4ef] p-0 text-[#2f7251] hover:bg-[#e2eee5]" onClick={onBack} type="button"><ArrowLeft className="size-4" /></Button><div className="min-w-0"><p className="truncate text-sm font-semibold">Content Automation</p><p className="hidden truncate text-[11px] text-[#7a897f] sm:block">Linked publishing</p></div></div><div className="hidden items-center gap-2 text-xs text-[#75847a] md:flex"><span className={cn("size-2 rounded-full", syncState === "error" ? "bg-[#d94d5c]" : syncState === "saving" || syncState === "loading" ? "bg-[#d69d21]" : "bg-[#35a363]")} />{statusText}</div><div className="flex shrink-0 items-center gap-1.5 overflow-x-auto"><Button aria-label="Refresh automation table" className="size-8 shrink-0 rounded-md border-transparent bg-[#2563eb] p-0 text-white hover:bg-[#1d4ed8] disabled:opacity-45" disabled={syncState === "loading" || syncState === "saving"} onClick={() => void loadAutomation()} type="button"><RefreshCw className={cn("size-4", syncState === "loading" && "animate-spin")} /></Button><Button aria-label="Save entire automation table" className="h-8 shrink-0 rounded-md border-transparent bg-[#168b51] px-3 text-xs text-white hover:bg-[#117342] disabled:opacity-45" disabled={!isHydrated || syncState === "saving"} onClick={() => void saveAutomation()} type="button"><Save className="size-3.5" />Save</Button><Button className="h-8 shrink-0 rounded-md border-transparent bg-[#c026d3] px-3 text-xs text-white hover:bg-[#a21caf] disabled:opacity-45" disabled={!activeRunId} onClick={() => { unlockMusicVideoAudio(); setIsGeneratedPostsOpen(true); }} type="button"><Sparkles className="size-3.5" />Generated posts</Button>{([{ days: 1 as const, label: "1 day", color: "#2563eb" }, { days: 3 as const, label: "3 days", color: "#9333ea" }, { days: 7 as const, label: "1 week", color: "#ea580c" }]).map((option) => <Button className="h-8 shrink-0 rounded-md border-transparent bg-[#111111] px-3 text-xs hover:bg-[#272727] disabled:opacity-45" disabled={!isHydrated || !sharedOutputCount || schedulingHorizon !== null} key={option.days} onClick={() => void scheduleAutomation(option.days)} style={{ color: option.color }} type="button"><CalendarPlus className="size-3.5" />{schedulingHorizon === option.days ? "Preparing…" : option.label}</Button>)}</div></header><main className="min-h-0 flex-1 overflow-auto"><div className="mx-auto max-w-[1800px] space-y-5 p-4 sm:p-6"><section className="overflow-hidden rounded-xl bg-[#2563eb] text-white"><div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_1fr] lg:p-7"><div><div className="flex items-center gap-2 text-[#b9e6c7]"><Layers3 aria-hidden="true" className="size-4" /><span className="text-xs font-semibold">Linked publishing</span></div><h1 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">One recipe. Every channel.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#d4edda]">Configure one account, then link compatible accounts to reuse its settings and publish one generated item everywhere.</p></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2"><div className="rounded-lg bg-white/10 p-3"><span className="text-[11px] text-black/70">Platforms</span><strong className="mt-1 block text-2xl font-semibold text-black">{platformCount}</strong></div><div className="rounded-lg bg-white/10 p-3"><span className="text-[11px] text-black/70">Accounts</span><strong className="mt-1 block text-2xl font-semibold text-black">{selectedAccountCount}</strong></div><div className="rounded-lg bg-white/10 p-3"><span className="text-[11px] text-black/70">Generated outputs</span><strong className="mt-1 block text-2xl font-semibold text-black">{sharedOutputCount}<span className="ml-1 text-xs font-normal text-black/70">/day</span></strong></div><div className="rounded-lg bg-white/10 p-3"><span className="text-[11px] text-black/70">Publish window</span><strong className="mt-1 block text-lg font-semibold text-black">11:00–23:00</strong></div><div className="mt-2 lg:col-span-2"><div className="rounded-md bg-white/15 p-3 text-white"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-white/75">Estimated cost</span><span className="text-[10px] text-white/65">AI generation</span></div><div className="mt-2 grid grid-cols-2 gap-2"><div><span className="block text-[10px] text-white/70">Daily</span><strong className="mt-0.5 block text-sm font-semibold">{formatAutomationCostTry(linkedCost.oneOffTry)}</strong></div><div><span className="block text-[10px] text-white/70">Monthly</span><strong className="mt-0.5 block text-sm font-semibold">{formatAutomationCostTry(linkedCost.monthlyTry)}</strong></div></div></div></div></div></div><div className="flex items-center gap-2 border-t border-white/10 bg-black/10 px-5 py-3 text-xs text-[#d4edda] lg:px-7"><Info aria-hidden="true" className="size-4 shrink-0" />{rawOutputCount > sharedOutputCount ? `${rawOutputCount - sharedOutputCount} duplicate generation${rawOutputCount - sharedOutputCount === 1 ? " is" : "s are"} avoided through linked accounts.` : "Link accounts from the dropdown to generate once and publish everywhere."}</div></section><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-[#17291f]">Account recipes</h2><p className="mt-1 text-sm text-[#718077]">Every connected account has its own content and generation settings.</p></div><div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#69796f] shadow-sm"><Clock3 aria-hidden="true" className="size-3.5 text-[#2f7251]" />Automatic window: 11:00–23:00</div></div>{!isHydrated ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-[#cbd9ce] bg-white text-sm text-[#7a897f]">Loading social media accounts…</div> : !recipes.length ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-[#cbd9ce] bg-white text-sm text-[#b24c58]">No non-email social media accounts are available.</div> : <div className="space-y-6">{languageGroups.map((group, groupIndex) => { const color = LANGUAGE_GROUP_COLORS[groupIndex % LANGUAGE_GROUP_COLORS.length]!; return <section className="space-y-3" key={group.key}><div className="flex items-center gap-3 rounded-lg px-4 py-3 text-white" style={{ backgroundColor: color }}><Globe2 aria-hidden="true" className="size-5 shrink-0" /><div className="min-w-0"><h3 className="flex items-center gap-1.5 text-sm font-semibold"><span>{languageSelectionLabel(group.nativeLanguage)}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /><span>{languageSelectionLabel(group.learningLanguage)}</span></h3><p className="mt-0.5 text-[11px] text-white/75">{group.recipes.length} connected account{group.recipes.length === 1 ? "" : "s"}</p></div></div><div className="grid gap-3 xl:grid-cols-2">{group.recipes.map((recipe, index) => <AccountRecipeCard expanded={expandedRecipeId === recipe.id} index={index} key={recipe.id} allowedContentTypes={getAllowedContentTypes(recipe)} linkOptions={getLinkOptions(recipe)} onChange={(update) => updateRecipe(recipe.id, update)} onLinkChange={(sourceId) => updateRecipeLink(recipe.id, sourceId)} onToggleExpanded={() => setExpandedRecipeId((current) => current === recipe.id ? null : recipe.id)} recipe={recipe} />)}</div></section>; })}</div>}</div></main><footer className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#d8e3da] bg-white px-4 py-2 text-xs text-[#75847a] sm:px-6"><span>Generated once per linked group, then sent to every selected account.</span><span className="font-semibold text-[#2f7251]">{sharedOutputCount} generated outputs/day · {selectedAccountCount} accounts</span></footer>{isGeneratedPostsOpen && activeRunId ? createPortal(<div aria-label="Generated posts" aria-modal="true" className="fixed inset-0 z-[9999] grid place-items-center p-4" role="dialog"><GeneratedPostsTable onClose={() => setIsGeneratedPostsOpen(false)} runId={activeRunId} scope="production" /></div>, document.body) : null}</section>;
}
