"use client";

import { ArrowLeft, CalendarPlus, ChevronDown, ChevronRight, Coins, Filter, FolderPlus, GripVertical, Pencil, Plus, RefreshCw, Save, Search, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { GeneratedPostsTable } from "@/features/twitter-automation/components/generated-posts-table";
import { automationScopeSearchParams, type AutomationScope } from "@/features/twitter-automation/automation-scope";
import { describeAutomationCostEstimate, estimateAutomationGroupCost, formatAutomationCostTry } from "@/features/twitter-automation/automation-cost-estimates";
import { AUTOMATION_GENERATOR_OPTIONS, RANDOM_GENERATOR, RANDOM_INCLUDE_OPTIONS, defaultRandomIncludes, normalizeGeneratorMode, normalizeRandomIncludes, resolveRandomIncludes, type AutomationContentType, type RandomInclude, type RandomIncludes } from "@/features/twitter-automation/automation-randomization";
import { cn } from "@/lib/utils";
import type { LanguageCode, Tier } from "@/types/domain";

type ContentType = "random" | "text" | "image" | "video";
type SelectableContentType = AutomationContentType;
type Platform = string;
type GroupTone = "emerald" | "blue" | "amber" | "rose";
type TierSelection = Tier | "random";
type LanguageSelection = LanguageCode | "random";
type SyncState = "loading" | "saved" | "saving" | "error";

interface SocialMediaAccount {
  id: string;
  platform: Platform;
  platformLabel: string;
  accountName: string;
}

interface PlatformOption {
  value: Platform;
  label: string;
}

interface AutomationRow {
  id: string;
  contentType: ContentType;
  generator: string;
  contentTypes: SelectableContentType[];
  generators: Partial<Record<SelectableContentType, string>>;
  randomIncludes: RandomIncludes;
  quantity: number;
  language: LanguageSelection;
  nativeLanguage: LanguageSelection;
  tier: TierSelection;
  platforms: Platform[];
  accounts: Partial<Record<Platform, string[]>>;
  scheduleStart: string;
  scheduleEnd: string;
  saved: boolean;
}

interface AutomationGroup {
  id: string;
  name: string;
  tone: GroupTone;
  color?: string;
  collapsed: boolean;
  rows: AutomationRow[];
}

interface AutomationResponse {
  groups?: AutomationGroup[];
  socialAccounts?: SocialMediaAccount[];
}

const CONTENT_TYPES: Array<{ value: SelectableContentType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
];

const GENERATORS = AUTOMATION_GENERATOR_OPTIONS;

const GROUP_TONES: Record<GroupTone, { color: string; header: string; row: string; text: string }> = {
  emerald: { color: "#55c39a", header: "bg-[#11251c]", row: "bg-[#101914]", text: "text-white" },
  blue: { color: "#62a9ef", header: "bg-[#101f30]", row: "bg-[#10171f]", text: "text-white" },
  amber: { color: "#caff46", header: "bg-[#1d2910]", row: "bg-[#151d0b]", text: "text-white" },
  rose: { color: "#ed7784", header: "bg-[#2b151a]", row: "bg-[#1d1215]", text: "text-white" },
};

const TONE_ORDER: GroupTone[] = ["emerald", "blue", "amber", "rose"];
const LANGUAGE_OPTIONS = Object.values(LANGUAGE_BY_CODE);
const CONTENT_QUANTITY_OPTIONS = Array.from({ length: 20 }, (_, index) => index + 1);
const cellControlClassName = "h-8 w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 text-xs text-[#f7f3ed] outline-none transition-colors hover:bg-white/[0.045] focus:border-[#55c39a] focus:bg-[#111715]";

function getPlatformOptions(accounts: readonly SocialMediaAccount[]) {
  const platforms = new Map<Platform, PlatformOption>();
  for (const account of accounts) {
    if (!platforms.has(account.platform)) {
      platforms.set(account.platform, { value: account.platform, label: account.platformLabel });
    }
  }
  return [...platforms.values()];
}

function getAccountsForPlatform(accounts: readonly SocialMediaAccount[], platform: Platform) {
  return accounts.filter((account) => account.platform === platform);
}

function createRow(socialAccounts: readonly SocialMediaAccount[]): AutomationRow {
  const firstAccount = socialAccounts[0];
  return {
    id: crypto.randomUUID(),
    contentType: "text",
    generator: RANDOM_GENERATOR,
    contentTypes: ["text"],
    generators: { text: RANDOM_GENERATOR },
    randomIncludes: { text: defaultRandomIncludes("text") },
    quantity: 1,
    language: "en",
    nativeLanguage: "en",
    tier: "random",
    platforms: firstAccount ? [firstAccount.platform] : [],
    accounts: firstAccount ? { [firstAccount.platform]: [firstAccount.id] } : {},
    scheduleStart: "09:00",
    scheduleEnd: "18:00",
    saved: false,
  };
}

function createGroup(name: string, tone: GroupTone, socialAccounts: readonly SocialMediaAccount[]): AutomationGroup {
  return { id: crypto.randomUUID(), name, tone, color: GROUP_TONES[tone].color, collapsed: false, rows: [createRow(socialAccounts)] };
}

function createInitialGroups(socialAccounts: readonly SocialMediaAccount[]) {
  return [
    createGroup("Word of the Day campaign", "emerald", socialAccounts),
    createGroup("AI visual campaign", "blue", socialAccounts),
  ];
}

function isGroupColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/iu.test(value);
}

function getGroupColor(group: AutomationGroup) {
  return isGroupColor(group.color) ? group.color : GROUP_TONES[group.tone].color;
}

function hexToHsv(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const saturation = maximum === 0 ? 0 : delta / maximum;
  let hue = 0;

  if (delta !== 0) {
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    else if (maximum === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
  }

  return { hue: (hue * 60 + 360) % 360, saturation, value: maximum };
}

function getRowColor(color: string) {
  const { hue, saturation, value } = hexToHsv(color);
  const adjustedSaturation = Math.max(0.08, saturation * 0.45);
  const adjustedValue = Math.max(0.07, value * 0.38);
  const chroma = adjustedValue * adjustedSaturation;
  const secondary = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const match = adjustedValue - chroma;
  const [red, green, blue] = hue < 60 ? [chroma, secondary, 0] : hue < 120 ? [secondary, chroma, 0] : hue < 180 ? [0, chroma, secondary] : hue < 240 ? [0, secondary, chroma] : hue < 300 ? [secondary, 0, chroma] : [chroma, 0, secondary];
  return `rgb(${Math.round((red + match) * 255)} ${Math.round((green + match) * 255)} ${Math.round((blue + match) * 255)})`;
}

function normalizeGroups(groups: AutomationGroup[], socialAccounts: readonly SocialMediaAccount[]) {
  const platformOptions = getPlatformOptions(socialAccounts);
  const validPlatforms = new Set(platformOptions.map((platform) => platform.value));

  return groups.map((group) => ({
    ...group,
    color: getGroupColor(group),
    rows: group.rows.map((row) => {
      const legacyRow = row as Partial<AutomationRow>;
      const contentTypes = (legacyRow.contentTypes ?? []).filter((type): type is SelectableContentType => type === "text" || type === "image" || type === "video");
      const resolvedContentTypes: SelectableContentType[] = contentTypes.length ? [...new Set(contentTypes)] : row.contentType === "image" ? ["image"] : row.contentType === "text" ? ["text"] : row.contentType === "video" ? ["video"] : ["text", "image", "video"];
      const rawGenerators: Record<SelectableContentType, string> = {
        text: legacyRow.generators?.text ?? (row.contentType === "text" ? row.generator : RANDOM_GENERATOR),
        image: legacyRow.generators?.image ?? (row.contentType === "image" ? row.generator : RANDOM_GENERATOR),
        video: legacyRow.generators?.video ?? (row.contentType === "video" ? row.generator : RANDOM_GENERATOR),
      };
      const generators: Partial<Record<SelectableContentType, string>> = {
        text: normalizeGeneratorMode("text", rawGenerators.text),
        image: normalizeGeneratorMode("image", rawGenerators.image),
        video: normalizeGeneratorMode("video", rawGenerators.video),
      };
      const randomIncludes: RandomIncludes = {
        text: resolveRandomIncludes("text", rawGenerators.text, legacyRow.randomIncludes?.text),
        image: resolveRandomIncludes("image", rawGenerators.image, legacyRow.randomIncludes?.image),
        video: resolveRandomIncludes("video", rawGenerators.video, legacyRow.randomIncludes?.video),
      };
      const selectedPlatforms = row.platforms.filter((platform) => validPlatforms.has(platform));
      const platforms = selectedPlatforms.length ? selectedPlatforms : platformOptions.slice(0, 1).map((platform) => platform.value);
      const accounts = Object.fromEntries(platforms.map((platform) => {
        const validAccounts = getAccountsForPlatform(socialAccounts, platform);
        const validIds = new Set(validAccounts.map((account) => account.id));
        const selectedIds = (row.accounts[platform] ?? []).filter((accountId) => validIds.has(accountId));
        return [platform, selectedIds.length ? selectedIds : validAccounts.slice(0, 1).map((account) => account.id)];
      }));
      const normalizedContentType: ContentType = resolvedContentTypes.length === 1 ? resolvedContentTypes[0]! : "random";
      const quantity = Number.isInteger(legacyRow.quantity) ? Math.min(20, Math.max(1, legacyRow.quantity!)) : 1;
      const language: LanguageSelection = legacyRow.language === "random" ? "random" : row.language;
      const nativeLanguage: LanguageSelection = legacyRow.nativeLanguage === "random" ? "random" : row.nativeLanguage;

      return {
        ...row,
        contentTypes: resolvedContentTypes,
        generators,
        randomIncludes,
        quantity,
        language,
        nativeLanguage,
        contentType: normalizedContentType,
        generator: resolvedContentTypes.length === 1 ? generators[resolvedContentTypes[0]] ?? RANDOM_GENERATOR : "random-content",
        platforms,
        accounts,
      };
    }),
  }));
}

function ColumnHeader({ label, type }: { label: string; type: string }) {
  return <th className="border-b border-r border-white/10 bg-[#171a19] px-3 py-2 text-left last:border-r-0"><span className="text-[11px] font-semibold text-[#e9f2ec]">{label}</span><span className="ml-1.5 text-[10px] text-[#7f9086]">{type}</span></th>;
}

function toggleItem<T>(items: readonly T[], item: T) {
  return items.includes(item) ? items.filter((entry) => entry !== item) : [...items, item];
}

export function AutomationTable({ onBack, onOpenAlternateAutomation, onOpenSocialMedias, scope = "production" }: {
  onBack: () => void;
  onOpenAlternateAutomation: () => void;
  onOpenSocialMedias: () => void;
  scope?: AutomationScope;
}) {
  const isTestAutomation = scope === "test";
  const scopeSearchParams = automationScopeSearchParams(scope);
  const [groups, setGroups] = useState<AutomationGroup[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialMediaAccount[]>([]);
  const [query, setQuery] = useState("");
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [draggedRow, setDraggedRow] = useState<{ groupId: string; rowId: string } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [schedulingHorizon, setSchedulingHorizon] = useState<1 | 3 | 7 | null>(null);
  const [scheduleError, setScheduleError] = useState("");
  const [isGeneratedPostsOpen, setIsGeneratedPostsOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const saveRequestId = useRef(0);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const platformOptions = getPlatformOptions(socialAccounts);
  const visibleGroups = groups.map((group) => ({
    ...group,
    rows: group.rows.filter((row) => !deferredQuery || [group.name, row.contentType, row.generator, row.platforms.join(" "), Object.values(row.accounts).flat().join(" "), row.language, row.nativeLanguage, row.tier].join(" ").toLocaleLowerCase().includes(deferredQuery)),
  })).filter((group) => group.rows.length > 0 || !deferredQuery);
  const rowCount = groups.reduce((total, group) => total + group.rows.length, 0);
  const dailyOutputCount = groups.reduce((total, group) => total + group.rows.reduce((groupTotal, row) => groupTotal + row.quantity, 0), 0);

  const loadAutomation = useCallback(async () => {
    setSyncState("loading");
    try {
      const response = await fetch(`/api/twitter-automation/automations${scopeSearchParams}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Automation state could not be loaded.");
      const payload = await response.json() as AutomationResponse;
      const nextSocialAccounts = Array.isArray(payload.socialAccounts) ? payload.socialAccounts : [];
      if (!nextSocialAccounts.length) throw new Error("No social media accounts are available.");

      const sourceGroups = Array.isArray(payload.groups) && payload.groups.length > 0
        ? payload.groups
        : createInitialGroups(nextSocialAccounts);
      setSocialAccounts(nextSocialAccounts);
      setGroups(normalizeGroups(sourceGroups, nextSocialAccounts));
      setSyncState("saved");
      setIsHydrated(true);
    } catch {
      setSyncState("error");
    }
  }, [scopeSearchParams]);

  useEffect(() => { void loadAutomation(); }, [loadAutomation]);

  useEffect(() => {
    if (!isHydrated) return;

    const timeout = window.setTimeout(() => {
      const requestId = ++saveRequestId.current;
      setSyncState("saving");
      void fetch(`/api/twitter-automation/automations${scopeSearchParams}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groups }),
      }).then((response) => {
        if (requestId !== saveRequestId.current) return;
        setSyncState(response.ok ? "saved" : "error");
      }).catch(() => {
        if (requestId === saveRequestId.current) setSyncState("error");
      });
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [groups, isHydrated, scopeSearchParams]);

  useEffect(() => {
    if (!isGeneratedPostsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsGeneratedPostsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isGeneratedPostsOpen]);

  function updateRow(groupId: string, rowId: string, update: Partial<AutomationRow>) {
    setGroups((current) => current.map((group) => group.id !== groupId ? group : {
      ...group,
      rows: group.rows.map((row) => row.id === rowId ? { ...row, ...update, saved: false } : row),
    }));
  }

  function saveRow(groupId: string, rowId: string) {
    setGroups((current) => current.map((group) => group.id !== groupId ? group : {
      ...group,
      rows: group.rows.map((row) => row.id === rowId ? { ...row, saved: true } : row),
    }));
  }

  function toggleContentType(groupId: string, row: AutomationRow, contentType: SelectableContentType) {
    const contentTypes = toggleItem(row.contentTypes, contentType);
    if (!contentTypes.length) return;
    const generators = { ...row.generators };
    if (!generators[contentType]) generators[contentType] = RANDOM_GENERATOR;
    updateRow(groupId, row.id, {
      contentTypes,
      generators,
      contentType: contentTypes.length === 1 ? contentTypes[0] : "random",
      generator: contentTypes.length === 1 ? generators[contentTypes[0]] ?? RANDOM_GENERATOR : "random-content",
    });
  }

  function selectGenerator(groupId: string, row: AutomationRow, contentType: SelectableContentType, generator: string) {
    const generators = { ...row.generators, [contentType]: generator };
    updateRow(groupId, row.id, {
      generators,
      randomIncludes: generator === RANDOM_GENERATOR
        ? { ...row.randomIncludes, [contentType]: normalizeRandomIncludes(contentType, row.randomIncludes[contentType]) }
        : row.randomIncludes,
      generator: row.contentTypes.length === 1 ? generator : "random-content",
    });
  }

  function toggleRandomInclude(groupId: string, row: AutomationRow, contentType: SelectableContentType, include: string) {
    const selected = normalizeRandomIncludes(contentType, row.randomIncludes[contentType]);
    const next = selected.includes(include as RandomInclude<typeof contentType>)
      ? selected.filter((item) => item !== include)
      : [...selected, include as RandomInclude<typeof contentType>];
    if (!next.length) return;
    updateRow(groupId, row.id, { randomIncludes: { ...row.randomIncludes, [contentType]: next } });
  }

  function togglePlatform(groupId: string, row: AutomationRow, platform: Platform) {
    const platforms = toggleItem(row.platforms, platform);
    if (!platforms.length) return;

    const accounts = { ...row.accounts };
    if (platforms.includes(platform) && !accounts[platform]?.length) {
      const account = getAccountsForPlatform(socialAccounts, platform)[0];
      if (account) accounts[platform] = [account.id];
    }
    if (!platforms.includes(platform)) delete accounts[platform];
    updateRow(groupId, row.id, { platforms, accounts });
  }

  function toggleAccount(groupId: string, row: AutomationRow, platform: Platform, accountId: string) {
    const selectedAccounts = toggleItem(row.accounts[platform] ?? [], accountId);
    if (!selectedAccounts.length) return;
    updateRow(groupId, row.id, { accounts: { ...row.accounts, [platform]: selectedAccounts } });
  }

  function moveRow(targetGroupId: string) {
    if (!draggedRow || draggedRow.groupId === targetGroupId) return;
    setGroups((current) => {
      const source = current.find((group) => group.id === draggedRow.groupId);
      const moved = source?.rows.find((row) => row.id === draggedRow.rowId);
      if (!moved) return current;
      return current.map((group) => group.id === draggedRow.groupId
        ? { ...group, rows: group.rows.filter((row) => row.id !== moved.id) }
        : group.id === targetGroupId ? { ...group, rows: [...group.rows, moved] } : group);
    });
    setDraggedRow(null);
  }

  async function scheduleAutomation(horizonDays: 1 | 3 | 7) {
    if (!isHydrated || schedulingHorizon) return;
    setSchedulingHorizon(horizonDays);
    setScheduleError("");
    try {
      setSyncState("saving");
      const saveResponse = await fetch(`/api/twitter-automation/automations${scopeSearchParams}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groups }),
      });
      if (!saveResponse.ok) throw new Error("The current automation table could not be saved.");
      setSyncState("saved");
      const response = await fetch("/api/twitter-automation/automation-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ horizonDays, scope }),
      });
      const payload = await response.json().catch(() => null) as { errorCode?: string; run?: { id?: string } } | null;
      if (!response.ok || !payload?.run?.id) throw new Error(payload?.errorCode === "automation_targets_missing" ? "Select at least one social account for each automation row." : "The automation run could not be created.");
      setActiveRunId(payload.run.id);
      setIsGeneratedPostsOpen(true);
    } catch (error) {
      setSyncState("error");
      setScheduleError(error instanceof Error ? error.message : "The automation run could not be created.");
    } finally {
      setSchedulingHorizon(null);
    }
  }

  const hasSocialAccounts = socialAccounts.length > 0;

  return <section className="content-automation-shell flex h-full min-h-0 flex-col overflow-hidden bg-[#101212] text-[#f7f3ed]">
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#171a19] px-3 py-1.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-2"><Button aria-label="Back to content studio" className="size-7 shrink-0 rounded border-white/10 bg-transparent p-0 text-[#d7e2da] hover:bg-white/[0.06]" onClick={onBack} type="button"><ArrowLeft className="size-3.5" /></Button><p className="truncate text-sm font-semibold">{isTestAutomation ? "Test automation" : "Content automation"}</p>{isTestAutomation ? <span className="rounded border border-[#f0b849]/50 bg-[#f0b849]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-[#f7c96f]">TEST</span> : null}</div>
      <div className="hidden items-center gap-2 text-xs text-[#829287] sm:flex"><span className={cn("size-2 rounded-full", syncState === "error" ? "bg-[#ed7784]" : syncState === "saving" || syncState === "loading" ? "bg-[#f0b849]" : "bg-[#55c39a]")} />{syncState === "loading" ? "Loading automation" : syncState === "saving" ? "Saving to Supabase" : syncState === "error" ? "Supabase unavailable" : "Saved to Supabase"}</div>
      <div className="flex shrink-0 gap-1.5"><Button aria-label="Refresh automation table" className="size-7 rounded border-white/10 bg-white/[0.045] p-0 text-[#d7e2da] hover:bg-white/[0.09]" disabled={syncState === "loading" || syncState === "saving"} onClick={() => void loadAutomation()} title="Refresh automation table" type="button"><RefreshCw className={cn("size-3.5", syncState === "loading" && "animate-spin")} /></Button><Button className="h-7 rounded border-white/10 bg-white/[0.045] px-2.5 text-xs text-[#d7e2da] hover:bg-white/[0.09]" onClick={onOpenAlternateAutomation} type="button">{isTestAutomation ? "Main table" : "Test table"}</Button><Button className="h-7 rounded border-transparent bg-[#c7f05d] px-2.5 text-xs text-black hover:bg-[#d6ff73]" onClick={onOpenSocialMedias} type="button">Social medias</Button><Button className="h-7 rounded border-transparent bg-[#c7f05d] px-2.5 text-xs text-black hover:bg-[#d6ff73] disabled:cursor-not-allowed disabled:opacity-45" disabled={!activeRunId} onClick={() => setIsGeneratedPostsOpen(true)} type="button"><Sparkles className="size-3.5" />Generated posts</Button><Button aria-label="New group" className="size-7 rounded border-white/10 bg-white/[0.045] p-0 text-[#d7e2da] hover:bg-white/[0.09]" disabled={!hasSocialAccounts} onClick={() => setGroups((current) => [...current, createGroup(`New campaign ${current.length + 1}`, TONE_ORDER[current.length % TONE_ORDER.length], socialAccounts)])} title="New group" type="button"><FolderPlus className="size-3.5" /></Button><Button aria-label="Insert row" className="size-7 rounded border-[#299d6d] bg-[#299d6d] p-0 text-white hover:bg-[#36ad79]" disabled={!hasSocialAccounts} onClick={() => setGroups((current) => current.map((group, index) => index === 0 ? { ...group, rows: [...group.rows, createRow(socialAccounts)] } : group))} title="Insert row" type="button"><Plus className="size-3.5" /></Button></div>
    </header>
    <div className="flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/10 bg-[#141716] px-3 sm:px-5"><label className="flex h-8 w-64 shrink-0 items-center gap-2 border border-white/10 bg-[#101212] px-2.5 text-[#8d9b92] focus-within:border-[#55c39a] sm:w-80"><Search className="size-3.5 shrink-0" /><input className="min-w-0 flex-1 bg-transparent text-xs text-[#f7f3ed] outline-none placeholder:text-[#718077]" onChange={(event) => setQuery(event.target.value)} placeholder="Filter automations..." value={query} /></label><span className="inline-flex h-7 shrink-0 items-center gap-1.5 px-1 text-xs text-[#a9b8ae]"><Filter className="size-3.5" />{rowCount} rows · {dailyOutputCount} outputs/day · {groups.length} groups</span><span className="ml-auto shrink-0 text-xs text-[#829287]">Generate:</span>{([{ days: 1 as const, label: "1 day" }, { days: 3 as const, label: "3 days" }, { days: 7 as const, label: "1 week" }]).map((option) => <Button className="h-7 shrink-0 rounded border-transparent bg-[#c7f05d] px-2.5 text-xs text-black hover:bg-[#d6ff73]" disabled={!hasSocialAccounts || !isHydrated || schedulingHorizon !== null} key={option.days} onClick={() => void scheduleAutomation(option.days)} type="button"><CalendarPlus className="size-3.5" />{schedulingHorizon === option.days ? "Preparing..." : option.label}</Button>)}{scheduleError ? <span className="shrink-0 text-xs text-[#ff9c8b]">{scheduleError}</span> : null}</div>
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain"><table className="min-w-[1620px] w-full border-collapse text-left"><thead className="sticky top-0 z-20"><tr><th className="w-11 border-b border-r border-white/10 bg-[#171a19] px-3 py-2"><input aria-label="Select all rows" className="accent-[#55c39a]" type="checkbox" /></th><ColumnHeader label="content_type" type="enum" /><ColumnHeader label="generator_mode" type="text" /><ColumnHeader label="quantity" type="integer" /><ColumnHeader label="parameters" type="json" /><ColumnHeader label="social_networks" type="array" /><ColumnHeader label="social_accounts" type="array" /><ColumnHeader label="schedule_window" type="time range" /><ColumnHeader label="state" type="text" /><th className="w-24 border-b border-white/10 bg-[#171a19] px-3 py-2" /></tr></thead><tbody>{visibleGroups.map((group) => <GroupRows group={group} groupColor={getGroupColor(group)} isRenaming={renamingGroupId === group.id} key={group.id} onAddRow={() => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, collapsed: false, rows: [...item.rows, createRow(socialAccounts)] } : item))} onDeleteGroup={() => setGroups((current) => current.length === 1 ? current : current.filter((item) => item.id !== group.id))} onDragOver={(event) => event.preventDefault()} onDrop={() => moveRow(group.id)} onRename={(name) => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, name } : item))} onRenameFinish={() => setRenamingGroupId(null)} onRenameStart={() => setRenamingGroupId(group.id)} onSetGroupColor={(color) => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, color } : item))} onToggle={() => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, collapsed: !item.collapsed } : item))} onUpdateRow={updateRow} onSaveGroup={() => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, rows: item.rows.map((row) => ({ ...row, saved: true })) } : item))} onSaveRow={saveRow} onSelectGenerator={selectGenerator} onToggleContentType={toggleContentType} onToggleRandomInclude={toggleRandomInclude} onToggleAccount={toggleAccount} onTogglePlatform={togglePlatform} onDeleteRow={(rowId) => setGroups((current) => current.map((item) => item.id !== group.id ? item : group.rows.length === 1 ? item : { ...item, rows: item.rows.filter((row) => row.id !== rowId) }))} onDragStart={(rowId) => setDraggedRow({ groupId: group.id, rowId })} platformOptions={platformOptions} socialAccounts={socialAccounts} tone={GROUP_TONES[group.tone]} />)}</tbody></table>{!isHydrated ? <div className="grid min-h-48 place-items-center border-b border-white/[0.075] text-sm text-[#8d9b92]">Loading social media accounts...</div> : !hasSocialAccounts ? <div className="grid min-h-48 place-items-center border-b border-white/[0.075] text-sm text-[#ffb9c1]">No non-email social media accounts are available.</div> : !visibleGroups.length ? <div className="grid min-h-48 place-items-center border-b border-white/[0.075] text-sm text-[#8d9b92]">No automation rows match this filter.</div> : null}</div>
    <footer className="flex min-h-10 shrink-0 items-center justify-between border-t border-white/10 bg-[#171a19] px-3 text-xs text-[#829287] sm:px-5"><span>{isTestAutomation ? "TEST table: content can be generated and reviewed, but it can never be scheduled to production." : "Buttons prepare the selected output quantity from each row for every future day. Each output gets its own random mode selection and time within the saved range."}</span><span>{dailyOutputCount} outputs/day</span></footer>
    {isGeneratedPostsOpen && activeRunId ? createPortal(<div aria-label="Generated posts" aria-modal="true" className="fixed inset-0 z-[9999] grid place-items-center p-4" role="dialog"><GeneratedPostsTable onClose={() => setIsGeneratedPostsOpen(false)} runId={activeRunId} scope={scope} /></div>, document.body) : null}
  </section>;
}

type ToneStyle = (typeof GROUP_TONES)[GroupTone];

interface GroupRowsProps {
  group: AutomationGroup;
  groupColor: string;
  tone: ToneStyle;
  isRenaming: boolean;
  platformOptions: PlatformOption[];
  socialAccounts: SocialMediaAccount[];
  onToggle: () => void;
  onRename: (name: string) => void;
  onRenameStart: () => void;
  onRenameFinish: () => void;
  onAddRow: () => void;
  onDeleteGroup: () => void;
  onSaveGroup: () => void;
  onSetGroupColor: (color: string) => void;
  onDragOver: (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop: () => void;
  onUpdateRow: (groupId: string, rowId: string, update: Partial<AutomationRow>) => void;
  onSaveRow: (groupId: string, rowId: string) => void;
  onToggleContentType: (groupId: string, row: AutomationRow, contentType: SelectableContentType) => void;
  onSelectGenerator: (groupId: string, row: AutomationRow, contentType: SelectableContentType, generator: string) => void;
  onToggleRandomInclude: (groupId: string, row: AutomationRow, contentType: SelectableContentType, include: string) => void;
  onTogglePlatform: (groupId: string, row: AutomationRow, platform: Platform) => void;
  onToggleAccount: (groupId: string, row: AutomationRow, platform: Platform, accountId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onDragStart: (rowId: string) => void;
}

// Kept temporarily so existing table structure remains available during the random-source migration.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyGroupRows({ group, groupColor, tone, isRenaming, platformOptions, socialAccounts, onToggle, onRename, onRenameStart, onRenameFinish, onAddRow, onDeleteGroup, onSaveGroup, onSetGroupColor, onDragOver, onDrop, onUpdateRow, onSaveRow, onToggleContentType, onSelectGenerator, onTogglePlatform, onToggleAccount, onDeleteRow, onDragStart }: GroupRowsProps) {
  const headerStyle: CSSProperties = { backgroundColor: groupColor };
  const rowStyle: CSSProperties = { backgroundColor: getRowColor(groupColor) };
  const costEstimate = estimateAutomationGroupCost(group.rows);
  const costDescription = describeAutomationCostEstimate(costEstimate);
  return <>
    <tr className={cn("group-header relative border-y border-white/10", tone.header)} onDragOver={onDragOver} onDrop={onDrop} style={headerStyle}><td className="relative p-0" colSpan={10}><span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: groupColor }} /><div className="flex h-12 items-center justify-between gap-3 px-4 pl-5"><div className="flex min-w-0 items-center gap-2"><Button aria-label={group.collapsed ? "Expand group" : "Collapse group"} className="size-7 shrink-0 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10" onClick={onToggle} type="button">{group.collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}</Button>{isRenaming ? <input autoFocus aria-label="Campaign name" className={cn("min-w-0 max-w-64 border-b border-current bg-transparent text-sm font-semibold outline-none", tone.text)} onBlur={onRenameFinish} onChange={(event) => onRename(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }} value={group.name} /> : <button className={cn("max-w-64 truncate text-left text-sm font-semibold", tone.text)} onClick={onRenameStart} type="button">{group.name}</button>}<Button aria-label="Rename group" className="size-7 shrink-0 rounded border-transparent bg-transparent p-0 text-[#aab7af] hover:bg-white/10 hover:text-white" onClick={onRenameStart} type="button"><Pencil className="size-3.5" /></Button><span className="shrink-0 text-xs text-[#93a39a]">{group.rows.length} rows</span></div><div className="ml-auto flex shrink-0 items-center gap-3"><div className="flex items-center gap-2 border-r border-black/15 pr-3 text-right" title={costDescription}><Coins aria-hidden="true" className="size-3.5 shrink-0 text-black/70" /><div className="leading-tight"><span className="mr-1.5 text-[10px] text-black/60">AI estimate</span><span className="text-xs font-semibold text-black">{formatAutomationCostTry(costEstimate.oneOffTry)}</span><span className="mx-1 text-black/40">·</span><span className="text-[10px] text-black/60">monthly</span><span className="ml-1 text-xs font-semibold text-black">{formatAutomationCostTry(costEstimate.monthlyTry)}</span></div></div><div className="flex shrink-0 items-center gap-1"><label className="grid size-7 cursor-pointer place-items-center rounded border border-white/10 bg-black/10" title="Group color"><span className="sr-only">Group color</span><input aria-label="Group color" className="size-5 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => onSetGroupColor(event.target.value)} type="color" value={groupColor} /></label><Button className="h-7 rounded border-white/10 bg-white/[0.05] px-2 text-xs text-[#d7e2da] hover:bg-white/10" onClick={onSaveGroup} type="button"><Save className="size-3.5" />Save group</Button><Button aria-label="Add row to group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10" onClick={onAddRow} type="button"><Plus className="size-3.5" /></Button><Button aria-label="Delete group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#ff9c8b] hover:bg-[#2c1917]" onClick={onDeleteGroup} type="button"><Trash2 className="size-3.5" /></Button></div></div></div></td></tr>
    {!group.collapsed ? group.rows.map((row) => <tr className={cn("group cursor-grab border-b border-white/[0.075]", tone.row)} draggable key={row.id} onDragStart={() => onDragStart(row.id)} style={rowStyle}><td className="border-r border-white/[0.075] px-2 py-2"><div className="flex items-center gap-1"><GripVertical className="size-3.5 text-[#617168]" /><input aria-label="Select automation row" className="accent-[#55c39a]" type="checkbox" /></div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-28 space-y-1.5">{CONTENT_TYPES.map((option) => <label className="flex items-center gap-1.5 text-xs text-[#d7e2da]" key={option.value}><input aria-label={`${option.label} content type`} checked={row.contentTypes.includes(option.value)} className="accent-[#55c39a]" onChange={() => onToggleContentType(group.id, row, option.value)} type="checkbox" />{option.label}</label>)}</div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-44 space-y-2">{row.contentTypes.map((contentType) => <label className="block" key={contentType}><span className="mb-1 block text-[10px] font-semibold text-[#8d9b92]">{CONTENT_TYPES.find((option) => option.value === contentType)?.label} generator</span><select aria-label={`${contentType} generator mode`} className={cellControlClassName} onChange={(event) => onSelectGenerator(group.id, row, contentType, event.target.value)} value={row.generators[contentType] ?? GENERATORS[contentType][0].value}>{GENERATORS[contentType].map((option) => <option key={option.value} value={option.value}>{option.source ? `${option.label} — ${option.source}` : option.label}</option>)}</select></label>)}</div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="grid grid-cols-3 gap-2"><label className="space-y-1"><span className="block text-[10px] font-semibold text-[#8d9b92]">Learning language</span><select aria-label="Learning language" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { language: event.target.value as LanguageCode })} value={row.language}>{LANGUAGE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.code.toUpperCase()}</option>)}</select></label><label className="space-y-1"><span className="block text-[10px] font-semibold text-[#8d9b92]">Native language</span><select aria-label="Native language" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { nativeLanguage: event.target.value as LanguageCode })} value={row.nativeLanguage}>{LANGUAGE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.code.toUpperCase()}</option>)}</select></label><label className="space-y-1"><span className="block text-[10px] font-semibold text-[#8d9b92]">Tier</span><select aria-label="Tier" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { tier: event.target.value as TierSelection })} value={row.tier}><option value="random">Random</option>{TIERS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="flex min-w-40 flex-wrap gap-x-2 gap-y-1.5 px-1"><span className="w-full text-[10px] text-[#7f9086]">Post once to each selected network</span>{platformOptions.map((platform) => <label className="flex items-center gap-1 text-xs text-[#d7e2da]" key={platform.value}><input aria-label={`${platform.label} network`} checked={row.platforms.includes(platform.value)} className="accent-[#55c39a]" onChange={() => onTogglePlatform(group.id, row, platform.value)} type="checkbox" />{platform.label}</label>)}</div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-48 space-y-3 px-1">{row.platforms.map((platform) => <div className="space-y-1.5" key={platform}><p className="text-xs font-semibold text-[#a9b8ae]">{platformOptions.find((item) => item.value === platform)?.label}</p><div className="space-y-1.5">{getAccountsForPlatform(socialAccounts, platform).toSorted((first, second) => first.accountName.localeCompare(second.accountName)).map((account) => <label className="flex items-center gap-1.5 text-xs text-[#d7e2da]" key={account.id}><input aria-label={`${account.accountName} account`} checked={row.accounts[platform]?.includes(account.id) ?? false} className="accent-[#55c39a]" onChange={() => onToggleAccount(group.id, row, platform, account.id)} type="checkbox" /><span>{account.accountName}</span></label>)}</div></div>)}</div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="flex items-center gap-1"><input aria-label="Schedule start time" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { scheduleStart: event.target.value })} type="time" value={row.scheduleStart} /><span className="text-[#718077]">to</span><input aria-label="Schedule end time" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { scheduleEnd: event.target.value })} type="time" value={row.scheduleEnd} /></div><p className="mt-1 px-1 text-[10px] text-[#7f9086]">Random publish time</p></td><td className="border-r border-white/[0.075] px-3 py-2"><span className={cn("text-xs font-medium", row.saved ? "text-[#55c39a]" : "text-[#e2bc64]")}>{row.saved ? "saved" : "draft"}</span></td><td className="px-2 py-2"><div className="flex gap-1"><Button aria-label="Save automation row" className="size-8 rounded border-transparent bg-transparent p-0 text-[#55c39a] hover:border-[#2b634a] hover:bg-[#15261d]" onClick={() => onSaveRow(group.id, row.id)} type="button"><Save className="size-3.5" /></Button><Button aria-label="Delete automation row" className="size-8 rounded border-transparent bg-transparent p-0 text-[#ff9c8b] hover:border-[#61352e] hover:bg-[#2c1917]" disabled={group.rows.length === 1} onClick={() => onDeleteRow(row.id)} type="button"><Trash2 className="size-3.5" /></Button></div></td></tr>) : null}
  </>;
}

function GroupRows(props: GroupRowsProps) {
  const { group, groupColor, tone, isRenaming, platformOptions, socialAccounts, onToggle, onRename, onRenameStart, onRenameFinish, onAddRow, onDeleteGroup, onSaveGroup, onSetGroupColor, onDragOver, onDrop, onUpdateRow, onSaveRow, onToggleContentType, onSelectGenerator, onToggleRandomInclude, onTogglePlatform, onToggleAccount, onDeleteRow, onDragStart } = props;
  const headerStyle: CSSProperties = { backgroundColor: groupColor };
  const rowStyle: CSSProperties = { backgroundColor: getRowColor(groupColor) };
  const costEstimate = estimateAutomationGroupCost(group.rows);
  const costDescription = describeAutomationCostEstimate(costEstimate);

  return <>
    <tr className={cn("group-header relative border-y border-white/10", tone.header)} onDragOver={onDragOver} onDrop={onDrop} style={headerStyle}>
      <td className="relative p-0" colSpan={10}>
        <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: groupColor }} />
        <div className="flex h-12 items-center justify-between gap-3 px-4 pl-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button aria-label={group.collapsed ? "Expand group" : "Collapse group"} className="size-7 shrink-0 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10" onClick={onToggle} type="button">{group.collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}</Button>
            {isRenaming ? <input autoFocus aria-label="Campaign name" className={cn("min-w-0 max-w-64 border-b border-current bg-transparent text-sm font-semibold outline-none", tone.text)} onBlur={onRenameFinish} onChange={(event) => onRename(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }} value={group.name} /> : <button className={cn("max-w-64 truncate text-left text-sm font-semibold", tone.text)} onClick={onRenameStart} type="button">{group.name}</button>}
            <Button aria-label="Rename group" className="size-7 shrink-0 rounded border-transparent bg-transparent p-0 text-[#aab7af] hover:bg-white/10 hover:text-white" onClick={onRenameStart} type="button"><Pencil className="size-3.5" /></Button>
            <span className="shrink-0 text-xs text-[#93a39a]">{group.rows.length} rows</span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-2 border-r border-black/15 pr-3 text-right" title={costDescription}>
              <Coins aria-hidden="true" className="size-3.5 shrink-0 text-black/70" />
              <div className="leading-tight"><span className="mr-1.5 text-[10px] text-black/60">AI estimate</span><span className="text-xs font-semibold text-black">{formatAutomationCostTry(costEstimate.oneOffTry)}</span><span className="mx-1 text-black/40">·</span><span className="text-[10px] text-black/60">monthly</span><span className="ml-1 text-xs font-semibold text-black">{formatAutomationCostTry(costEstimate.monthlyTry)}</span></div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <label className="grid size-7 cursor-pointer place-items-center rounded border border-white/10 bg-black/10" title="Group color"><span className="sr-only">Group color</span><input aria-label="Group color" className="size-5 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => onSetGroupColor(event.target.value)} type="color" value={groupColor} /></label>
              <Button className="h-7 rounded border-white/10 bg-white/[0.05] px-2 text-xs text-[#d7e2da] hover:bg-white/10" onClick={onSaveGroup} type="button"><Save className="size-3.5" />Save group</Button>
              <Button aria-label="Add row to group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10" onClick={onAddRow} type="button"><Plus className="size-3.5" /></Button>
              <Button aria-label="Delete group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#ff9c8b] hover:bg-[#2c1917]" onClick={onDeleteGroup} type="button"><Trash2 className="size-3.5" /></Button>
            </div>
          </div>
        </div>
      </td>
    </tr>
    {!group.collapsed ? group.rows.map((row) => <tr className={cn("group cursor-grab border-b border-white/[0.075]", tone.row)} draggable key={row.id} onDragStart={() => onDragStart(row.id)} style={rowStyle}>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="flex items-center gap-1"><GripVertical className="size-3.5 text-[#617168]" /><input aria-label="Select automation row" className="accent-[#55c39a]" type="checkbox" /></div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-28 space-y-1.5">{CONTENT_TYPES.map((option) => <label className="flex items-center gap-1.5 text-xs text-[#d7e2da]" key={option.value}><input aria-label={`${option.label} content type`} checked={row.contentTypes.includes(option.value)} className="accent-[#55c39a]" onChange={() => onToggleContentType(group.id, row, option.value)} type="checkbox" />{option.label}</label>)}</div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-52 space-y-3">{row.contentTypes.map((contentType) => <GeneratorModeSelector contentType={contentType} generator={row.generators[contentType] ?? RANDOM_GENERATOR} key={contentType} onSelect={(generator) => onSelectGenerator(group.id, row, contentType, generator)} onToggleInclude={(include) => onToggleRandomInclude(group.id, row, contentType, include)} randomIncludes={row.randomIncludes[contentType]} />)}</div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><label className="block min-w-24"><span className="mb-1 block text-[10px] font-semibold text-[#8d9b92]">Outputs per day</span><select aria-label="Outputs per automation row" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { quantity: Number(event.target.value) })} value={row.quantity}>{CONTENT_QUANTITY_OPTIONS.map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}</select><span className="mt-1 block text-[10px] text-[#7f9086]">Each gets a random time</span></label></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="grid grid-cols-3 gap-2"><label className="space-y-1"><span className="block text-[10px] font-semibold text-[#8d9b92]">Learning language</span><select aria-label="Learning language" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { language: event.target.value as LanguageSelection })} value={row.language}><option value="random">Random</option>{LANGUAGE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.code.toUpperCase()}</option>)}</select></label><label className="space-y-1"><span className="block text-[10px] font-semibold text-[#8d9b92]">Native language</span><select aria-label="Native language" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { nativeLanguage: event.target.value as LanguageSelection })} value={row.nativeLanguage}><option value="random">Random</option>{LANGUAGE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.code.toUpperCase()}</option>)}</select></label><label className="space-y-1"><span className="block text-[10px] font-semibold text-[#8d9b92]">Tier</span><select aria-label="Tier" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { tier: event.target.value as TierSelection })} value={row.tier}><option value="random">Random</option>{TIERS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="flex min-w-40 flex-wrap gap-x-2 gap-y-1.5 px-1"><span className="w-full text-[10px] text-[#7f9086]">Post once to each selected network</span>{platformOptions.map((platform) => <label className="flex items-center gap-1 text-xs text-[#d7e2da]" key={platform.value}><input aria-label={`${platform.label} network`} checked={row.platforms.includes(platform.value)} className="accent-[#55c39a]" onChange={() => onTogglePlatform(group.id, row, platform.value)} type="checkbox" />{platform.label}</label>)}</div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-48 space-y-3 px-1">{row.platforms.map((platform) => <div className="space-y-1.5" key={platform}><p className="text-xs font-semibold text-[#a9b8ae]">{platformOptions.find((item) => item.value === platform)?.label}</p><div className="space-y-1.5">{getAccountsForPlatform(socialAccounts, platform).toSorted((first, second) => first.accountName.localeCompare(second.accountName)).map((account) => <label className="flex items-center gap-1.5 text-xs text-[#d7e2da]" key={account.id}><input aria-label={`${account.accountName} account`} checked={row.accounts[platform]?.includes(account.id) ?? false} className="accent-[#55c39a]" onChange={() => onToggleAccount(group.id, row, platform, account.id)} type="checkbox" /><span>{account.accountName}</span></label>)}</div></div>)}</div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="flex items-center gap-1"><input aria-label="Schedule start time" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { scheduleStart: event.target.value })} type="time" value={row.scheduleStart} /><span className="text-[#718077]">to</span><input aria-label="Schedule end time" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { scheduleEnd: event.target.value })} type="time" value={row.scheduleEnd} /></div><p className="mt-1 px-1 text-[10px] text-[#7f9086]">Random publish time</p></td>
      <td className="border-r border-white/[0.075] px-3 py-2"><span className={cn("text-xs font-medium", row.saved ? "text-[#55c39a]" : "text-[#e2bc64]")}>{row.saved ? "saved" : "draft"}</span></td>
      <td className="px-2 py-2"><div className="flex gap-1"><Button aria-label="Save automation row" className="size-8 rounded border-transparent bg-transparent p-0 text-[#55c39a] hover:border-[#2b634a] hover:bg-[#15261d]" onClick={() => onSaveRow(group.id, row.id)} type="button"><Save className="size-3.5" /></Button><Button aria-label="Delete automation row" className="size-8 rounded border-transparent bg-transparent p-0 text-[#ff9c8b] hover:border-[#61352e] hover:bg-[#2c1917]" disabled={group.rows.length === 1} onClick={() => onDeleteRow(row.id)} type="button"><Trash2 className="size-3.5" /></Button></div></td>
    </tr>) : null}
  </>;
}

function GeneratorModeSelector({ contentType, generator, randomIncludes, onSelect, onToggleInclude }: {
  contentType: SelectableContentType;
  generator: string;
  randomIncludes: readonly string[] | undefined;
  onSelect: (generator: string) => void;
  onToggleInclude: (include: string) => void;
}) {
  const isRandom = generator === RANDOM_GENERATOR;
  const selectedIncludes = normalizeRandomIncludes(contentType, randomIncludes);
  const includeOptions = RANDOM_INCLUDE_OPTIONS[contentType];

  return <div>
    <label className="block"><span className="mb-1 block text-[10px] font-semibold text-[#8d9b92]">{CONTENT_TYPES.find((option) => option.value === contentType)?.label} generator</span><select aria-label={`${contentType} generator mode`} className={cellControlClassName} onChange={(event) => onSelect(event.target.value)} value={generator}>{AUTOMATION_GENERATOR_OPTIONS[contentType].map((option) => <option key={option.value} value={option.value}>{option.source ? `${option.label} — ${option.source}` : option.label}</option>)}</select></label>
    {isRandom ? <fieldset className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-l border-[#55c39a]/50 pl-2"><legend className="sr-only">Random includes</legend><span className="text-[10px] text-[#8d9b92]">Include:</span>{includeOptions.map((option) => <label className="flex items-center gap-1 text-[10px] text-[#d7e2da]" key={option.value}><input aria-label={`${contentType} random includes ${option.label}`} checked={selectedIncludes.includes(option.value as never)} className="accent-[#55c39a]" disabled={includeOptions.length === 1} onChange={() => onToggleInclude(option.value)} type="checkbox" />{option.label}</label>)}</fieldset> : null}
  </div>;
}
