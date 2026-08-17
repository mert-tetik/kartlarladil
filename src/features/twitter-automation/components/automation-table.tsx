"use client";

import { ArrowLeft, Bell, CalendarPlus, ChevronDown, ChevronRight, Coins, Copy, Eye, EyeOff, FileText, Filter, FolderInput, FolderPlus, FolderTree, GripVertical, ImageIcon, KeyRound, MoveDown, MoveUp, Pencil, Plus, RefreshCw, Save, Search, Share2, Shuffle, Sparkles, Trash2, Unlink2, Video } from "lucide-react";
import { createContext, Fragment, useCallback, useContext, useDeferredValue, useEffect, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { GeneratedPostsTable } from "@/features/twitter-automation/components/generated-posts-table";
import { unlockMusicVideoAudio } from "@/features/twitter-automation/music-video-renderer";
import { automationScopeSearchParams, type AutomationScope } from "@/features/twitter-automation/automation-scope";
import { describeAutomationCostEstimate, estimateAutomationGroupCost, formatAutomationCostTry } from "@/features/twitter-automation/automation-cost-estimates";
import { AUTOMATION_GROUP_ICON_OPTIONS, normalizeAutomationGroupIcon, type AutomationGroupIcon } from "@/features/twitter-automation/automation-group-icons";
import { AUTOMATION_SUPER_GROUP_ICON_OPTIONS, normalizeAutomationSuperGroupColor, normalizeAutomationSuperGroupIcon, type AutomationSuperGroup, type AutomationSuperGroupIcon } from "@/features/twitter-automation/automation-super-groups";
import { describeExpectedOutputSourceMix, estimateAutomationOutputDistribution } from "@/features/twitter-automation/automation-output-distribution";
import { AUTOMATION_GENERATOR_OPTIONS, RANDOM_GENERATOR, RANDOM_INCLUDE_OPTIONS, defaultRandomIncludes, normalizeGeneratorMode, normalizeRandomIncludes, resolveRandomIncludes, type AutomationContentType, type RandomInclude, type RandomIncludes } from "@/features/twitter-automation/automation-randomization";
import { cn } from "@/lib/utils";
import { ensureBrowserPushSubscription, serializePushSubscription } from "@/features/push/push-client";
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
  icon?: AutomationGroupIcon;
  superGroupId?: string;
  hidden?: boolean;
  collapsed: boolean;
  rows: AutomationRow[];
}

interface AutomationResponse {
  groups?: AutomationGroup[];
  superGroups?: AutomationSuperGroup[];
  socialAccounts?: SocialMediaAccount[];
}

interface GroupActionsContextValue {
  groups: readonly AutomationGroup[];
  visibleGroups: readonly AutomationGroup[];
  superGroups: readonly AutomationSuperGroup[];
  addSuperGroup: () => void;
  duplicateGroup: (groupId: string) => void;
  moveGroup: (groupId: string, direction: -1 | 1) => void;
  assignGroupToSuperGroup: (groupId: string, superGroupId: string) => void;
  removeGroupFromSuperGroup: (groupId: string) => void;
  renameSuperGroup: (superGroupId: string, name: string) => void;
  updateSuperGroupIcon: (superGroupId: string, icon: AutomationSuperGroupIcon) => void;
  updateSuperGroupColor: (superGroupId: string, color: string) => void;
  moveSuperGroup: (superGroupId: string, direction: -1 | 1) => void;
  toggleSuperGroupHidden: (superGroupId: string) => void;
  toggleGroupHidden: (groupId: string) => void;
  deleteSuperGroup: (superGroupId: string) => void;
}

const GroupActionsContext = createContext<GroupActionsContextValue | null>(null);

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
const flagSelectClassName = "h-8 w-full min-w-0 appearance-none rounded border border-transparent bg-transparent px-1.5 text-transparent outline-none transition-colors hover:bg-white/[0.045] focus:border-[#55c39a] focus:bg-[#111715]";
const flagSelectOptionStyle = { backgroundColor: "#171a19", color: "#f7f3ed" } as const;

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
  return { id: crypto.randomUUID(), name, tone, color: GROUP_TONES[tone].color, icon: "flag", collapsed: false, rows: [createRow(socialAccounts)] };
}

function createSuperGroup(name: string): AutomationSuperGroup {
  return { id: crypto.randomUUID(), name, icon: "social", color: "#16232c", hidden: false };
}

function copyAutomationRow(row: AutomationRow): AutomationRow {
  return {
    ...row,
    id: crypto.randomUUID(),
    contentTypes: [...row.contentTypes],
    generators: { ...row.generators },
    randomIncludes: {
      ...(row.randomIncludes.text ? { text: [...row.randomIncludes.text] } : {}),
      ...(row.randomIncludes.image ? { image: [...row.randomIncludes.image] } : {}),
      ...(row.randomIncludes.video ? { video: [...row.randomIncludes.video] } : {}),
    },
    platforms: [...row.platforms],
    accounts: Object.fromEntries(Object.entries(row.accounts).map(([platform, accountIds]) => [platform, [...(accountIds ?? [])]])),
    saved: false,
  };
}

function getCopiedGroupName(group: AutomationGroup, groups: readonly AutomationGroup[]) {
  const baseName = `${group.name} copy`;
  const takenNames = new Set(groups.map((item) => item.name));
  if (!takenNames.has(baseName)) return baseName;

  let copyNumber = 2;
  while (takenNames.has(`${baseName} ${copyNumber}`)) copyNumber += 1;
  return `${baseName} ${copyNumber}`;
}

function copyAutomationGroup(group: AutomationGroup, groups: readonly AutomationGroup[]): AutomationGroup {
  return {
    ...group,
    id: crypto.randomUUID(),
    name: getCopiedGroupName(group, groups),
    collapsed: false,
    rows: group.rows.map(copyAutomationRow),
  };
}

function moveAutomationGroup(groups: readonly AutomationGroup[], groupId: string, direction: -1 | 1): AutomationGroup[] {
  const group = groups.find((item) => item.id === groupId);
  if (!group) return [...groups];

  const siblingIndexes = groups.flatMap((item, index) => item.superGroupId === group.superGroupId ? [index] : []);
  const siblingIndex = siblingIndexes.findIndex((index) => groups[index]?.id === groupId);
  const targetIndex = siblingIndexes[siblingIndex + direction];
  const index = siblingIndexes[siblingIndex];
  if (index === undefined || targetIndex === undefined) return [...groups];

  const reorderedGroups = [...groups];
  [reorderedGroups[index], reorderedGroups[targetIndex]] = [reorderedGroups[targetIndex], reorderedGroups[index]];
  return reorderedGroups;
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

function getSuperGroupColor(superGroup: AutomationSuperGroup) {
  return normalizeAutomationSuperGroupColor(superGroup.color);
}

function getGroupIcon(group: AutomationGroup) {
  return normalizeAutomationGroupIcon(group.icon);
}

function getGroupIconOption(icon: AutomationGroupIcon) {
  return AUTOMATION_GROUP_ICON_OPTIONS.find((option) => option.value === icon)!;
}

function SuperGroupIcon({ icon, size = "trigger" }: { icon: AutomationSuperGroupIcon; size?: "trigger" | "header" | "picker" }) {
  const Icon = icon === "video" ? Video : icon === "image" ? ImageIcon : icon === "text" ? FileText : Share2;
  return <Icon aria-hidden="true" className={size === "picker" ? "size-6" : size === "header" ? "size-10" : "size-4"} />;
}

function GroupIcon({ icon, size }: { icon: AutomationGroupIcon; size: "trigger" | "picker" }) {
  const option = getGroupIconOption(icon);
  const isCountry = option.category === "country";
  const width = isCountry ? (size === "trigger" ? 36 : 48) : (size === "trigger" ? 30 : 34);
  const height = isCountry ? (size === "trigger" ? 27 : 36) : (size === "trigger" ? 30 : 34);
  return <Image alt="" aria-hidden="true" className={isCountry ? "rounded-[2px] object-cover" : "object-contain"} height={height} src={option.src} unoptimized width={width} />;
}

function LanguageFlag({ language }: { language: LanguageCode }) {
  const selectedLanguage = LANGUAGE_BY_CODE[language];
  return <Image alt={`${selectedLanguage.name} flag`} className="rounded-[2px] object-cover" height={18} src={`/automation-group-icons/flags/${selectedLanguage.flagCode}.svg`} unoptimized width={24} />;
}

function AutomationLanguageSelect({ label, onChange, value }: { label: string; onChange: (value: LanguageSelection) => void; value: LanguageSelection }) {
  const selectedLanguage = value === "random" ? null : value;
  const selectedLanguageLabel = selectedLanguage ? LANGUAGE_BY_CODE[selectedLanguage].name : "Random language";

  return <label className="block min-w-0 space-y-1">
    <span className="block text-[10px] font-semibold text-[#8d9b92]">{label}</span>
    <div className="relative" title={selectedLanguageLabel}>
      <select aria-label={label} className={flagSelectClassName} onChange={(event) => onChange(event.target.value as LanguageSelection)} value={value}>
        <option style={flagSelectOptionStyle} value="random">Random</option>
        {LANGUAGE_OPTIONS.map((option) => <option key={option.code} style={flagSelectOptionStyle} value={option.code}>{option.name}</option>)}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center">
        {selectedLanguage ? <LanguageFlag language={selectedLanguage} /> : <Shuffle className="size-3.5 text-[#b2c0b7]" />}
      </span>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-[#b2c0b7]" />
    </div>
  </label>;
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

function normalizeSuperGroups(superGroups: readonly AutomationSuperGroup[]) {
  return superGroups.map((superGroup) => ({ ...superGroup, color: getSuperGroupColor(superGroup), hidden: superGroup.hidden === true, icon: normalizeAutomationSuperGroupIcon(superGroup.icon) }));
}

function orderGroupsBySuperGroup(groups: readonly AutomationGroup[], superGroups: readonly AutomationSuperGroup[]) {
  const superGroupIds = new Set(superGroups.map((superGroup) => superGroup.id));
  const ungroupedGroups = groups.filter((group) => !group.superGroupId || !superGroupIds.has(group.superGroupId));
  return [...superGroups.flatMap((superGroup) => groups.filter((group) => group.superGroupId === superGroup.id)), ...ungroupedGroups];
}

function normalizeGroups(groups: AutomationGroup[], socialAccounts: readonly SocialMediaAccount[], superGroups: readonly AutomationSuperGroup[]) {
  const platformOptions = getPlatformOptions(socialAccounts);
  const validPlatforms = new Set(platformOptions.map((platform) => platform.value));
  const validSuperGroupIds = new Set(superGroups.map((superGroup) => superGroup.id));

  return groups.map((group) => ({
    ...group,
    color: getGroupColor(group),
    icon: getGroupIcon(group),
    superGroupId: group.superGroupId && validSuperGroupIds.has(group.superGroupId) ? group.superGroupId : undefined,
    hidden: group.hidden === true,
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
  const [superGroups, setSuperGroups] = useState<AutomationSuperGroup[]>([]);
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
  const [rendererToken, setRendererToken] = useState<string | null>(null);
  const [isCreatingRendererToken, setIsCreatingRendererToken] = useState(false);
  const [isSubscribingAutomationPush, setIsSubscribingAutomationPush] = useState(false);
  const saveRequestId = useRef(0);
  const pendingAutoSaveTimeout = useRef<number | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const platformOptions = getPlatformOptions(socialAccounts);
  const hiddenSuperGroupIds = new Set(superGroups.filter((superGroup) => superGroup.hidden).map((superGroup) => superGroup.id));
  const renderableGroups = groups.filter((group) => !group.hidden && (!group.superGroupId || !hiddenSuperGroupIds.has(group.superGroupId)));
  const visibleGroups = orderGroupsBySuperGroup(groups, superGroups).map((group) => ({
    ...group,
    rows: group.rows.filter((row) => !deferredQuery || [group.name, row.contentType, row.generator, row.platforms.join(" "), Object.values(row.accounts).flat().join(" "), row.language, row.nativeLanguage, row.tier].join(" ").toLocaleLowerCase().includes(deferredQuery)),
  })).filter((group) => group.rows.length > 0 || !deferredQuery);
  const rowCount = renderableGroups.reduce((total, group) => total + group.rows.length, 0);
  const dailyOutputCount = renderableGroups.reduce((total, group) => total + group.rows.reduce((groupTotal, row) => groupTotal + row.quantity, 0), 0);
  const dailyCostEstimate = estimateAutomationGroupCost(renderableGroups.flatMap((group) => group.rows));
  const dailyOutputDistribution = estimateAutomationOutputDistribution(renderableGroups.flatMap((group) => group.rows));
  const dailyOutputMix = describeExpectedOutputSourceMix(dailyOutputDistribution);
  const superGroupSections = superGroups.map((superGroup) => ({
    superGroup,
    groups: visibleGroups.filter((group) => group.superGroupId === superGroup.id),
  })).filter((section) => section.groups.length > 0 || !deferredQuery);
  const ungroupedVisibleGroups = visibleGroups.filter((group) => !group.superGroupId || !superGroups.some((superGroup) => superGroup.id === group.superGroupId));

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
      const nextSuperGroups = normalizeSuperGroups(Array.isArray(payload.superGroups) ? payload.superGroups : []);
      setSocialAccounts(nextSocialAccounts);
      setSuperGroups(nextSuperGroups);
      setGroups(normalizeGroups(sourceGroups, nextSocialAccounts, nextSuperGroups));
      setSyncState("saved");
      setIsHydrated(true);
    } catch {
      setSyncState("error");
    }
  }, [scopeSearchParams]);

  useEffect(() => { void loadAutomation(); }, [loadAutomation]);

  const saveAutomation = useCallback(async () => {
    if (!isHydrated) return false;

    const requestId = ++saveRequestId.current;
    setSyncState("saving");
    try {
      const response = await fetch(`/api/twitter-automation/automations${scopeSearchParams}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ groups, superGroups }),
      });
      if (!response.ok) throw new Error("Automation state could not be saved.");
      if (requestId === saveRequestId.current) setSyncState("saved");
      return true;
    } catch {
      if (requestId === saveRequestId.current) setSyncState("error");
      return false;
    }
  }, [groups, isHydrated, scopeSearchParams, superGroups]);

  useEffect(() => {
    if (!isHydrated) return;

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
  }, [groups, isHydrated, saveAutomation]);

  function saveAllAutomation() {
    if (pendingAutoSaveTimeout.current !== null) {
      window.clearTimeout(pendingAutoSaveTimeout.current);
      pendingAutoSaveTimeout.current = null;
    }
    void saveAutomation();
  }

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

  function moveGroup(groupId: string, direction: -1 | 1) {
    setGroups((current) => moveAutomationGroup(current, groupId, direction));
  }

  function duplicateGroup(groupId: string) {
    setGroups((current) => {
      const sourceIndex = current.findIndex((group) => group.id === groupId);
      if (sourceIndex < 0) return current;

      const copiedGroup = copyAutomationGroup(current[sourceIndex], current);
      return [...current.slice(0, sourceIndex + 1), copiedGroup, ...current.slice(sourceIndex + 1)];
    });
  }

  function addSuperGroup() {
    setSuperGroups((current) => [...current, createSuperGroup(`New upper group ${current.length + 1}`)]);
  }

  function assignGroupToSuperGroup(groupId: string, superGroupId: string) {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, superGroupId } : group));
  }

  function removeGroupFromSuperGroup(groupId: string) {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, superGroupId: undefined } : group));
  }

  function renameSuperGroup(superGroupId: string, name: string) {
    setSuperGroups((current) => current.map((superGroup) => superGroup.id === superGroupId ? { ...superGroup, name } : superGroup));
  }

  function updateSuperGroupIcon(superGroupId: string, icon: AutomationSuperGroupIcon) {
    setSuperGroups((current) => current.map((superGroup) => superGroup.id === superGroupId ? { ...superGroup, icon } : superGroup));
  }

  function updateSuperGroupColor(superGroupId: string, color: string) {
    setSuperGroups((current) => current.map((superGroup) => superGroup.id === superGroupId ? { ...superGroup, color: normalizeAutomationSuperGroupColor(color) } : superGroup));
  }

  function moveSuperGroup(superGroupId: string, direction: -1 | 1) {
    setSuperGroups((current) => {
      const currentIndex = current.findIndex((superGroup) => superGroup.id === superGroupId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      [next[currentIndex], next[targetIndex]] = [next[targetIndex]!, next[currentIndex]!];
      return next;
    });
  }

  function toggleSuperGroupHidden(superGroupId: string) {
    setSuperGroups((current) => current.map((superGroup) => superGroup.id === superGroupId ? { ...superGroup, hidden: !superGroup.hidden } : superGroup));
  }

  function toggleGroupHidden(groupId: string) {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, hidden: !group.hidden } : group));
  }

  function deleteSuperGroup(superGroupId: string) {
    setSuperGroups((current) => current.filter((superGroup) => superGroup.id !== superGroupId));
    setGroups((current) => current.map((group) => group.superGroupId === superGroupId ? { ...group, superGroupId: undefined } : group));
  }

  async function scheduleAutomation(horizonDays: 1 | 3 | 7) {
    if (!isHydrated || schedulingHorizon) return;
    unlockMusicVideoAudio();
    setSchedulingHorizon(horizonDays);
    setScheduleError("");
    try {
      setSyncState("saving");
      const saved = await saveAutomation();
      if (!saved) throw new Error("The current automation table could not be saved.");
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

  async function createRendererToken() {
    if (isCreatingRendererToken) return;
    setIsCreatingRendererToken(true);
    try {
      const response = await fetch(`/api/twitter-automation/renderers${scopeSearchParams}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: `Windows renderer ${new Date().toLocaleDateString("tr-TR")}`, scope }),
      });
      const payload = await response.json().catch(() => null) as { token?: string; errorCode?: string } | null;
      if (!response.ok || !payload?.token) throw new Error(payload?.errorCode ?? "automation_renderer_register_failed");
      setRendererToken(payload.token);
    } catch {
      setScheduleError("Renderer tokeni oluşturulamadı.");
    } finally {
      setIsCreatingRendererToken(false);
    }
  }

  async function subscribeAutomationPush() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!publicKey) { setScheduleError("PWA bildirim anahtarı yapılandırılmamış."); return; }
    if (isSubscribingAutomationPush) return;
    setIsSubscribingAutomationPush(true);
    try {
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission !== "granted") throw new Error("push_permission_denied");
      const subscription = await ensureBrowserPushSubscription(publicKey);
      const response = await fetch(`/api/twitter-automation/automation-notifications${scopeSearchParams}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(serializePushSubscription(subscription)),
      });
      if (!response.ok) throw new Error("automation_push_subscription_failed");
    } catch {
      setScheduleError("Telefon bildirimi bağlanamadı.");
    } finally {
      setIsSubscribingAutomationPush(false);
    }
  }

  const hasSocialAccounts = socialAccounts.length > 0;

  function renderGroupRows(group: AutomationGroup) {
    return <GroupRows group={group} groupColor={getGroupColor(group)} isRenaming={renamingGroupId === group.id} key={group.id} onAddRow={() => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, collapsed: false, rows: [...item.rows, createRow(socialAccounts)] } : item))} onDeleteGroup={() => setGroups((current) => current.length === 1 ? current : current.filter((item) => item.id !== group.id))} onDragOver={(event) => event.preventDefault()} onDrop={() => moveRow(group.id)} onRename={(name) => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, name } : item))} onRenameFinish={() => setRenamingGroupId(null)} onRenameStart={() => setRenamingGroupId(group.id)} onSetGroupColor={(color) => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, color } : item))} onSetGroupIcon={(icon) => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, icon } : item))} onToggle={() => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, collapsed: !item.collapsed } : item))} onUpdateRow={updateRow} onSaveGroup={() => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, rows: item.rows.map((row) => ({ ...row, saved: true })) } : item))} onSaveRow={saveRow} onSelectGenerator={selectGenerator} onToggleContentType={toggleContentType} onToggleRandomInclude={toggleRandomInclude} onToggleAccount={toggleAccount} onTogglePlatform={togglePlatform} onDeleteRow={(rowId) => setGroups((current) => current.map((item) => item.id !== group.id ? item : group.rows.length === 1 ? item : { ...item, rows: item.rows.filter((row) => row.id !== rowId) }))} onDragStart={(rowId) => setDraggedRow({ groupId: group.id, rowId })} platformOptions={platformOptions} socialAccounts={socialAccounts} tone={GROUP_TONES[group.tone]} />;
  }

  return <GroupActionsContext.Provider value={{ groups, visibleGroups, superGroups, addSuperGroup, duplicateGroup, moveGroup, assignGroupToSuperGroup, removeGroupFromSuperGroup, renameSuperGroup, updateSuperGroupIcon, updateSuperGroupColor, moveSuperGroup, toggleSuperGroupHidden, toggleGroupHidden, deleteSuperGroup }}><section className="content-automation-shell flex h-full min-h-0 flex-col overflow-hidden bg-[#101212] text-[#f7f3ed]">
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#171a19] px-3 py-1.5 sm:px-5">
      <div className="flex min-w-0 items-center gap-2"><Button aria-label="Back to content studio" className="size-7 shrink-0 rounded border-white/10 bg-transparent p-0 text-[#d7e2da] hover:bg-white/[0.06]" onClick={onBack} type="button"><ArrowLeft className="size-3.5" /></Button><p className="truncate text-sm font-semibold">{isTestAutomation ? "Test automation" : "Content automation"}</p>{isTestAutomation ? <span className="rounded border border-[#f0b849]/50 bg-[#f0b849]/10 px-1.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-[#f7c96f]">TEST</span> : null}</div>
      <div className="hidden items-center gap-2 text-xs text-[#829287] sm:flex"><span className={cn("size-2 rounded-full", syncState === "error" ? "bg-[#ed7784]" : syncState === "saving" || syncState === "loading" ? "bg-[#f0b849]" : "bg-[#55c39a]")} />{syncState === "loading" ? "Loading automation" : syncState === "saving" ? "Saving to Supabase" : syncState === "error" ? "Supabase unavailable" : "Saved to Supabase"}</div>
      <div className="flex shrink-0 gap-1.5"><Button aria-label="Refresh automation table" className="size-7 rounded border-white/10 bg-white/[0.045] p-0 text-[#d7e2da] hover:bg-white/[0.09]" disabled={syncState === "loading" || syncState === "saving"} onClick={() => void loadAutomation()} title="Refresh automation table" type="button"><RefreshCw className={cn("size-3.5", syncState === "loading" && "animate-spin")} /></Button><Button aria-label="Save entire automation table" className="h-7 rounded border-[#299d6d] bg-[#299d6d] px-2.5 text-xs text-white hover:bg-[#36ad79] disabled:cursor-not-allowed disabled:opacity-45" disabled={!isHydrated || syncState === "loading" || syncState === "saving"} onClick={saveAllAutomation} title="Save entire automation table" type="button"><Save className="size-3.5" />Save</Button><Button className="h-7 rounded border-white/10 bg-white/[0.045] px-2.5 text-xs text-[#d7e2da] hover:bg-white/[0.09]" onClick={onOpenAlternateAutomation} type="button">{isTestAutomation ? "Main table" : "Test table"}</Button><Button className="h-7 rounded border-transparent bg-[#c7f05d] px-2.5 text-xs text-black hover:bg-[#d6ff73]" onClick={onOpenSocialMedias} type="button">Social medias</Button>{!isTestAutomation ? <><Button className="h-7 border border-[#8cc8ef]/35 bg-[#8cc8ef]/10 px-2.5 text-xs text-[#d5efff] hover:bg-[#8cc8ef]/20" disabled={isSubscribingAutomationPush} onClick={() => void subscribeAutomationPush()} title="Batch bittiğinde telefona PWA bildirimi gönder" type="button"><Bell className="size-3.5" />{isSubscribingAutomationPush ? "Bağlanıyor" : "Telefon bildirimi"}</Button><Button className="h-7 border border-[#c7f05d]/35 bg-[#c7f05d]/10 px-2.5 text-xs text-[#dffb99] hover:bg-[#c7f05d]/20" disabled={isCreatingRendererToken} onClick={() => void createRendererToken()} title="Windows renderer için tek kullanımlık eşleştirme tokeni" type="button"><KeyRound className="size-3.5" />{isCreatingRendererToken ? "Hazırlanıyor" : "Renderer token"}</Button></> : null}<Button className="h-7 rounded border-transparent bg-[#c7f05d] px-2.5 text-xs text-black hover:bg-[#d6ff73] disabled:cursor-not-allowed disabled:opacity-45" disabled={!activeRunId} onClick={() => { unlockMusicVideoAudio(); setIsGeneratedPostsOpen(true); }} type="button"><Sparkles className="size-3.5" />Generated posts</Button><Button aria-label="New group" className="size-7 rounded border-white/10 bg-white/[0.045] p-0 text-[#d7e2da] hover:bg-white/[0.09]" disabled={!hasSocialAccounts} onClick={() => setGroups((current) => [...current, createGroup(`New campaign ${current.length + 1}`, TONE_ORDER[current.length % TONE_ORDER.length], socialAccounts)])} title="New group" type="button"><FolderPlus className="size-3.5" /></Button><Button aria-label="New upper group" className="size-7 rounded border-[#8cc8ef]/40 bg-[#16232c] p-0 text-[#c6e5f8] hover:bg-[#1c3340]" disabled={!isHydrated} onClick={addSuperGroup} title="New upper group" type="button"><FolderTree className="size-3.5" /></Button><Button aria-label="Insert row" className="size-7 rounded border-[#299d6d] bg-[#299d6d] p-0 text-white hover:bg-[#36ad79]" disabled={!hasSocialAccounts} onClick={() => setGroups((current) => current.map((group, index) => index === 0 ? { ...group, rows: [...group.rows, createRow(socialAccounts)] } : group))} title="Insert row" type="button"><Plus className="size-3.5" /></Button></div>
    </header>
    {rendererToken ? <div className="flex shrink-0 items-center gap-2 border-b border-[#c7f05d]/20 bg-[#182014] px-3 py-2 text-xs text-[#dffb99] sm:px-5"><KeyRound className="size-3.5 shrink-0" /><span className="shrink-0 font-medium">Tek seferlik renderer tokeni:</span><code className="min-w-0 flex-1 truncate rounded bg-black/25 px-2 py-1 font-mono text-[11px]">{rendererToken}</code><Button className="h-7 shrink-0 border border-[#c7f05d]/35 bg-transparent px-2 text-xs text-[#dffb99] hover:bg-[#c7f05d]/10" onClick={() => void navigator.clipboard.writeText(rendererToken)} type="button"><Copy className="size-3.5" />Kopyala</Button><Button aria-label="Renderer tokenini gizle" className="size-7 shrink-0 border border-white/10 bg-transparent p-0 text-[#d7e2da] hover:bg-white/[0.06]" onClick={() => setRendererToken(null)} type="button"><EyeOff className="size-3.5" /></Button></div> : null}
    <div className="flex h-11 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/10 bg-[#141716] px-3 sm:px-5"><label className="flex h-8 w-64 shrink-0 items-center gap-2 border border-white/10 bg-[#101212] px-2.5 text-[#8d9b92] focus-within:border-[#55c39a] sm:w-80"><Search className="size-3.5 shrink-0" /><input className="min-w-0 flex-1 bg-transparent text-xs text-[#f7f3ed] outline-none placeholder:text-[#718077]" onChange={(event) => setQuery(event.target.value)} placeholder="Filter automations..." value={query} /></label><span className="inline-flex h-7 shrink-0 items-center gap-1.5 px-1 text-xs text-[#a9b8ae]" title={`Expected source mix: ${dailyOutputMix}`}><Filter className="size-3.5" />{rowCount} active rows · {dailyOutputCount} outputs/day · est. {formatAutomationCostTry(dailyCostEstimate.oneOffTry)}/day · {groups.length} groups</span><span className="ml-auto shrink-0 text-xs text-[#829287]">Generate:</span>{([{ days: 1 as const, label: "1 day" }, { days: 3 as const, label: "3 days" }, { days: 7 as const, label: "1 week" }]).map((option) => <Button className="h-7 shrink-0 rounded border-transparent bg-[#c7f05d] px-2.5 text-xs text-black hover:bg-[#d6ff73]" disabled={!hasSocialAccounts || !isHydrated || !dailyOutputCount || schedulingHorizon !== null} key={option.days} onClick={() => void scheduleAutomation(option.days)} type="button"><CalendarPlus className="size-3.5" />{schedulingHorizon === option.days ? "Preparing..." : option.label}</Button>)}{scheduleError ? <span className="shrink-0 text-xs text-[#ff9c8b]">{scheduleError}</span> : null}</div>
    <div className="min-h-0 flex-1 overflow-auto overscroll-contain"><table className="min-w-[1620px] w-full border-collapse text-left"><thead className="sticky top-0 z-20"><tr><th className="w-11 border-b border-r border-white/10 bg-[#171a19] px-3 py-2"><input aria-label="Select all rows" className="accent-[#55c39a]" type="checkbox" /></th><ColumnHeader label="content_type" type="enum" /><ColumnHeader label="generator_mode" type="text" /><ColumnHeader label="quantity" type="integer" /><ColumnHeader label="parameters" type="json" /><ColumnHeader label="social_networks" type="array" /><ColumnHeader label="social_accounts" type="array" /><ColumnHeader label="schedule_window" type="time range" /><ColumnHeader label="state" type="text" /><th className="w-24 border-b border-white/10 bg-[#171a19] px-3 py-2" /></tr></thead><tbody>{superGroupSections.map((section) => <Fragment key={section.superGroup.id}><SuperGroupHeader memberCount={section.groups.length} superGroup={section.superGroup} />{section.groups.map(renderGroupRows)}</Fragment>)}{ungroupedVisibleGroups.map(renderGroupRows)}</tbody></table>{!isHydrated ? <div className="grid min-h-48 place-items-center border-b border-white/[0.075] text-sm text-[#8d9b92]">Loading social media accounts...</div> : !hasSocialAccounts ? <div className="grid min-h-48 place-items-center border-b border-white/[0.075] text-sm text-[#ffb9c1]">No non-email social media accounts are available.</div> : !visibleGroups.length ? <div className="grid min-h-48 place-items-center border-b border-white/[0.075] text-sm text-[#8d9b92]">No automation rows match this filter.</div> : null}</div>
    <footer className="flex min-h-10 shrink-0 items-center justify-between border-t border-white/10 bg-[#171a19] px-3 text-xs text-[#829287] sm:px-5"><span>{isTestAutomation ? "TEST table: content can be generated and reviewed, but it can never be scheduled to production." : "Buttons prepare the selected output quantity from each row for every future day. Each output gets its own random mode selection and time within the saved range."}</span><span title={`Expected source mix: ${dailyOutputMix}`}>{dailyOutputCount} outputs/day · est. {formatAutomationCostTry(dailyCostEstimate.oneOffTry)}/day</span></footer>
    {isGeneratedPostsOpen && activeRunId ? createPortal(<div aria-label="Generated posts" aria-modal="true" className="fixed inset-0 z-[9999] grid place-items-center p-4" role="dialog"><GeneratedPostsTable onClose={() => setIsGeneratedPostsOpen(false)} runId={activeRunId} scope={scope} /></div>, document.body) : null}
  </section></GroupActionsContext.Provider>;
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
  onSetGroupIcon: (icon: AutomationGroupIcon) => void;
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

function SuperGroupHeader({ superGroup, memberCount }: { superGroup: AutomationSuperGroup; memberCount: number }) {
  const groupActions = useContext(GroupActionsContext);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const superGroupIndex = groupActions?.superGroups.findIndex((item) => item.id === superGroup.id) ?? -1;
  const canMoveSuperGroupUp = superGroupIndex > 0;
  const canMoveSuperGroupDown = superGroupIndex >= 0 && superGroupIndex < (groupActions?.superGroups.length ?? 0) - 1;
  const superGroupColor = getSuperGroupColor(superGroup);

  useEffect(() => {
    if (!isIconPickerOpen) return;

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (!iconPickerRef.current?.contains(event.target as Node)) setIsIconPickerOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [isIconPickerOpen]);

  return <tr className={cn("super-group-header border-y border-white/20", superGroup.hidden && "opacity-60")} data-super-group-id={superGroup.id} style={{ backgroundColor: superGroupColor }}>
    <td className="relative p-0" colSpan={10}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: superGroupColor }} />
      <div className="flex h-14 items-center justify-between gap-3 px-4 pl-6">
        <div className="flex min-w-0 items-center gap-2">
          <FolderTree aria-hidden="true" className="size-5 shrink-0 text-white" />
          <div className="relative" ref={iconPickerRef}>
            <Button aria-expanded={isIconPickerOpen} aria-haspopup="dialog" aria-label={`Choose visual for ${superGroup.name}`} className="size-12 shrink-0 rounded bg-transparent p-0 text-white hover:bg-black/10" onClick={() => setIsIconPickerOpen((current) => !current)} title="Choose upper group visual" type="button"><SuperGroupIcon icon={superGroup.icon} size="header" /></Button>
            {isIconPickerOpen ? <div aria-label="Upper group visual choices" className="absolute left-0 top-12 z-40 grid w-56 grid-cols-4 gap-1.5 rounded-lg border border-white/15 bg-[#101212] p-2 shadow-sm" role="dialog">{AUTOMATION_SUPER_GROUP_ICON_OPTIONS.map((option) => <Button aria-label={`Use ${option.label} upper group icon`} aria-pressed={superGroup.icon === option.value} className={cn("flex h-12 rounded border p-0 text-white hover:bg-[#1c3340]", superGroup.icon === option.value ? "border-white bg-white/10" : "border-transparent bg-transparent")} key={option.value} onClick={() => { groupActions?.updateSuperGroupIcon(superGroup.id, option.value); setIsIconPickerOpen(false); }} title={option.label} type="button"><SuperGroupIcon icon={option.value} size="picker" /></Button>)}</div> : null}
          </div>
          {isRenaming ? <input autoFocus aria-label="Upper group name" className="min-w-0 max-w-64 border-b border-[#8cc8ef] bg-transparent text-sm font-semibold text-[#e7f5ff] outline-none" onBlur={() => setIsRenaming(false)} onChange={(event) => groupActions?.renameSuperGroup(superGroup.id, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }} value={superGroup.name} /> : <button className="max-w-64 truncate text-left text-sm font-semibold text-[#e7f5ff]" onClick={() => setIsRenaming(true)} type="button">{superGroup.name}</button>}
          <Button aria-label="Rename upper group" className="size-7 shrink-0 rounded border-transparent bg-transparent p-0 text-[#9dbbcf] hover:bg-white/10 hover:text-white" onClick={() => setIsRenaming(true)} type="button"><Pencil className="size-3.5" /></Button>
          <span className="shrink-0 text-xs text-[#9dbbcf]">{memberCount} groups</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button aria-label="Move upper group up" className="size-7 rounded border-transparent bg-transparent p-0 text-[#e7f5ff] hover:bg-black/15 disabled:cursor-not-allowed disabled:opacity-35" disabled={!canMoveSuperGroupUp} onClick={() => groupActions?.moveSuperGroup(superGroup.id, -1)} title="Move upper group up" type="button"><MoveUp className="size-3.5" /></Button>
          <Button aria-label="Move upper group down" className="size-7 rounded border-transparent bg-transparent p-0 text-[#e7f5ff] hover:bg-black/15 disabled:cursor-not-allowed disabled:opacity-35" disabled={!canMoveSuperGroupDown} onClick={() => groupActions?.moveSuperGroup(superGroup.id, 1)} title="Move upper group down" type="button"><MoveDown className="size-3.5" /></Button>
          <Button aria-label={superGroup.hidden ? "Show upper group" : "Hide upper group"} className="size-7 rounded border-transparent bg-transparent p-0 text-[#e7f5ff] hover:bg-black/15" onClick={() => groupActions?.toggleSuperGroupHidden(superGroup.id)} title={superGroup.hidden ? "Show upper group in daily generation" : "Hide upper group from daily generation"} type="button">{superGroup.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Button>
          <label className="grid size-7 cursor-pointer place-items-center rounded border border-white/20 bg-black/15" title="Upper group color"><span className="sr-only">Upper group color</span><input aria-label="Upper group color" className="size-5 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => groupActions?.updateSuperGroupColor(superGroup.id, event.target.value)} type="color" value={superGroupColor} /></label>
          <Button aria-label="Delete upper group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#ffb1aa] hover:bg-[#2c1917]" onClick={() => groupActions?.deleteSuperGroup(superGroup.id)} title="Delete upper group and ungroup its campaigns" type="button"><Trash2 className="size-3.5" /></Button>
        </div>
      </div>
    </td>
  </tr>;
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
    {!group.collapsed ? group.rows.map((row) => <tr className={cn("group cursor-grab border-b border-white/[0.075]", tone.row)} draggable key={row.id} onDragStart={() => onDragStart(row.id)} style={rowStyle}><td className="border-r border-white/[0.075] px-2 py-2"><div className="flex items-center gap-1"><GripVertical className="size-3.5 text-[#617168]" /><input aria-label="Select automation row" className="accent-[#55c39a]" type="checkbox" /></div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-28 space-y-1.5">{CONTENT_TYPES.map((option) => <label className="flex items-center gap-1.5 text-xs text-[#d7e2da]" key={option.value}><input aria-label={`${option.label} content type`} checked={row.contentTypes.includes(option.value)} className="accent-[#55c39a]" onChange={() => onToggleContentType(group.id, row, option.value)} type="checkbox" />{option.label}</label>)}</div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-44 space-y-2">{row.contentTypes.map((contentType) => <label className="block" key={contentType}><span className="mb-1 block text-[10px] font-semibold text-[#8d9b92]">{CONTENT_TYPES.find((option) => option.value === contentType)?.label} generator</span><select aria-label={`${contentType} generator mode`} className={cellControlClassName} onChange={(event) => onSelectGenerator(group.id, row, contentType, event.target.value)} value={row.generators[contentType] ?? GENERATORS[contentType][0].value}>{GENERATORS[contentType].map((option) => <option key={option.value} value={option.value}>{option.source ? `${option.label} — ${option.source}` : option.label}</option>)}</select></label>)}</div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="grid grid-cols-3 gap-2"><AutomationLanguageSelect label="Learning language" onChange={(language) => onUpdateRow(group.id, row.id, { language })} value={row.language} /><AutomationLanguageSelect label="Native language" onChange={(nativeLanguage) => onUpdateRow(group.id, row.id, { nativeLanguage })} value={row.nativeLanguage} /><label className="space-y-1"><span className="block text-[10px] font-semibold text-[#8d9b92]">Tier</span><select aria-label="Tier" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { tier: event.target.value as TierSelection })} value={row.tier}><option value="random">Random</option>{TIERS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="flex min-w-40 flex-wrap gap-x-2 gap-y-1.5 px-1"><span className="w-full text-[10px] text-[#7f9086]">Post once to each selected network</span>{platformOptions.map((platform) => <label className="flex items-center gap-1 text-xs text-[#d7e2da]" key={platform.value}><input aria-label={`${platform.label} network`} checked={row.platforms.includes(platform.value)} className="accent-[#55c39a]" onChange={() => onTogglePlatform(group.id, row, platform.value)} type="checkbox" />{platform.label}</label>)}</div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-48 space-y-3 px-1">{row.platforms.map((platform) => <div className="space-y-1.5" key={platform}><p className="text-xs font-semibold text-[#a9b8ae]">{platformOptions.find((item) => item.value === platform)?.label}</p><div className="space-y-1.5">{getAccountsForPlatform(socialAccounts, platform).toSorted((first, second) => first.accountName.localeCompare(second.accountName)).map((account) => <label className="flex items-center gap-1.5 text-xs text-[#d7e2da]" key={account.id}><input aria-label={`${account.accountName} account`} checked={row.accounts[platform]?.includes(account.id) ?? false} className="accent-[#55c39a]" onChange={() => onToggleAccount(group.id, row, platform, account.id)} type="checkbox" /><span>{account.accountName}</span></label>)}</div></div>)}</div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="flex items-center gap-1"><input aria-label="Schedule start time" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { scheduleStart: event.target.value })} type="time" value={row.scheduleStart} /><span className="text-[#718077]">to</span><input aria-label="Schedule end time" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { scheduleEnd: event.target.value })} type="time" value={row.scheduleEnd} /></div><p className="mt-1 px-1 text-[10px] text-[#7f9086]">Random publish time</p></td><td className="border-r border-white/[0.075] px-3 py-2"><span className={cn("text-xs font-medium", row.saved ? "text-[#55c39a]" : "text-[#e2bc64]")}>{row.saved ? "saved" : "draft"}</span></td><td className="px-2 py-2"><div className="flex gap-1"><Button aria-label="Save automation row" className="size-8 rounded border-transparent bg-transparent p-0 text-[#55c39a] hover:border-[#2b634a] hover:bg-[#15261d]" onClick={() => onSaveRow(group.id, row.id)} type="button"><Save className="size-3.5" /></Button><Button aria-label="Delete automation row" className="size-8 rounded border-transparent bg-transparent p-0 text-[#ff9c8b] hover:border-[#61352e] hover:bg-[#2c1917]" disabled={group.rows.length === 1} onClick={() => onDeleteRow(row.id)} type="button"><Trash2 className="size-3.5" /></Button></div></td></tr>) : null}
  </>;
}

function GroupRows(props: GroupRowsProps) {
  const { group, groupColor, tone, isRenaming, platformOptions, socialAccounts, onToggle, onRename, onRenameStart, onRenameFinish, onAddRow, onDeleteGroup, onSaveGroup, onSetGroupColor, onSetGroupIcon, onDragOver, onDrop, onUpdateRow, onSaveRow, onToggleContentType, onSelectGenerator, onToggleRandomInclude, onTogglePlatform, onToggleAccount, onDeleteRow, onDragStart } = props;
  const groupActions = useContext(GroupActionsContext);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isSuperGroupPickerOpen, setIsSuperGroupPickerOpen] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const superGroupPickerRef = useRef<HTMLDivElement>(null);
  const headerStyle: CSSProperties = { backgroundColor: groupColor };
  const rowStyle: CSSProperties = { backgroundColor: getRowColor(groupColor) };
  const costEstimate = estimateAutomationGroupCost(group.rows);
  const costDescription = describeAutomationCostEstimate(costEstimate);
  const groupIcon = getGroupIcon(group);
  const groupIconOption = getGroupIconOption(groupIcon);
  const countryIcons = AUTOMATION_GROUP_ICON_OPTIONS.filter((option) => option.category === "country");
  const socialIcons = AUTOMATION_GROUP_ICON_OPTIONS.filter((option) => option.category === "social");
  const siblingGroups = groupActions?.groups.filter((item) => item.superGroupId === group.superGroupId) ?? [];
  const groupIndex = siblingGroups.findIndex((item) => item.id === group.id);
  const canMoveGroupUp = groupIndex > 0;
  const canMoveGroupDown = groupIndex >= 0 && groupIndex < siblingGroups.length - 1;
  const superGroup = group.superGroupId ? groupActions?.superGroups.find((item) => item.id === group.superGroupId) : undefined;
  const isHiddenBySuperGroup = Boolean(superGroup?.hidden);
  const isEffectivelyHidden = group.hidden || isHiddenBySuperGroup;
  const groupAccentColor = superGroup ? getSuperGroupColor(superGroup) : groupColor;

  useEffect(() => {
    if (!isIconPickerOpen && !isSuperGroupPickerOpen) return;

    function closeOnOutsidePointerDown(event: PointerEvent) {
      if (iconPickerRef.current?.contains(event.target as Node) || superGroupPickerRef.current?.contains(event.target as Node)) return;
      setIsIconPickerOpen(false);
      setIsSuperGroupPickerOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [isIconPickerOpen, isSuperGroupPickerOpen]);

  return <>
    <tr className={cn("group-header relative border-y border-white/10", tone.header, isEffectivelyHidden && "opacity-60")} onDragOver={onDragOver} onDrop={onDrop} style={headerStyle}>
      <td className="relative p-0" colSpan={10}>
        <span className={cn("absolute inset-y-0 left-0", superGroup ? "w-1.5" : "w-1")} style={{ backgroundColor: groupAccentColor }} />
        <div className="flex h-14 items-center justify-between gap-3 px-4 pl-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button aria-label={group.collapsed ? "Expand group" : "Collapse group"} className="size-7 shrink-0 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10" onClick={onToggle} type="button">{group.collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}</Button>
            <div className="relative" ref={iconPickerRef}>
              <Button aria-expanded={isIconPickerOpen} aria-haspopup="dialog" aria-label={`Choose visual for ${group.name}`} className={cn("size-11 shrink-0 rounded border p-0", groupIconOption.category === "social" ? "border-white/45 bg-white hover:bg-white/90" : "border-white/15 bg-black/15 hover:bg-black/25")} onClick={() => setIsIconPickerOpen((current) => !current)} title="Choose group visual" type="button"><GroupIcon icon={groupIcon} size="trigger" /></Button>
              {isIconPickerOpen ? <div aria-label="Group visual choices" className="absolute left-0 top-12 z-30 max-h-[min(40rem,calc(100vh-5rem))] w-80 overflow-y-auto rounded-lg border border-white/15 bg-[#101212] p-4 shadow-sm" role="dialog"><p className="mb-2 text-xs font-semibold text-[#aab7af]">Countries</p><div className="grid grid-cols-3 gap-2">{countryIcons.map((option) => <Button aria-label={`Use ${option.label} flag`} aria-pressed={groupIcon === option.value} className={cn("flex h-16 rounded border p-0 hover:bg-white/[0.08]", groupIcon === option.value ? "border-[#55c39a] bg-white/10" : "border-transparent bg-transparent")} key={option.value} onClick={() => { onSetGroupIcon(option.value); setIsIconPickerOpen(false); }} title={option.label} type="button"><GroupIcon icon={option.value} size="picker" /></Button>)}</div><div className="my-4 h-px bg-white/10" /><p className="mb-2 text-xs font-semibold text-[#aab7af]">Social media</p><div className="grid grid-cols-5 gap-2">{socialIcons.map((option) => <Button aria-label={`Use ${option.label} logo`} aria-pressed={groupIcon === option.value} className={cn("flex h-[3.25rem] rounded border p-0 bg-white hover:bg-white/90", groupIcon === option.value ? "border-[#55c39a]" : "border-white/70")} key={option.value} onClick={() => { onSetGroupIcon(option.value); setIsIconPickerOpen(false); }} title={option.label} type="button"><GroupIcon icon={option.value} size="picker" /></Button>)}</div></div> : null}
            </div>
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
              <Button aria-label="Move group up" className="size-7 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35" disabled={!canMoveGroupUp} onClick={() => groupActions?.moveGroup(group.id, -1)} title="Move group up" type="button"><MoveUp className="size-3.5" /></Button>
              <Button aria-label="Move group down" className="size-7 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35" disabled={!canMoveGroupDown} onClick={() => groupActions?.moveGroup(group.id, 1)} title="Move group down" type="button"><MoveDown className="size-3.5" /></Button>
              <Button aria-label={group.hidden ? "Show group" : "Hide group"} className="size-7 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10" onClick={() => groupActions?.toggleGroupHidden(group.id)} title={group.hidden ? "Show group in daily generation" : "Hide group from daily generation"} type="button">{group.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Button>
              <Button aria-label="Duplicate group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35" disabled={!groupActions} onClick={() => groupActions?.duplicateGroup(group.id)} title="Duplicate group" type="button"><Copy className="size-3.5" /></Button>
              <div className="relative" ref={superGroupPickerRef}>
                <Button aria-expanded={isSuperGroupPickerOpen} aria-haspopup="dialog" aria-label="Add group to upper group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#b9dff6] hover:bg-[#1c3340]" onClick={() => { setIsIconPickerOpen(false); setIsSuperGroupPickerOpen((current) => !current); }} title="Add group to upper group" type="button"><FolderInput className="size-3.5" /></Button>
                {isSuperGroupPickerOpen ? <div aria-label="Upper groups" className="absolute right-0 top-8 z-40 w-56 rounded-lg border border-white/15 bg-[#101212] p-2 shadow-sm" role="dialog"><p className="px-1.5 py-1 text-[10px] font-semibold text-[#aab7af]">Move to upper group</p>{groupActions?.superGroups.length ? <div className="space-y-1">{groupActions.superGroups.map((item) => <Button className={cn("flex h-8 w-full justify-start gap-2 rounded px-2 text-xs text-[#e5f4ff] hover:bg-[#1c3340]", group.superGroupId === item.id && "bg-[#1c3340]")} key={item.id} onClick={() => { groupActions.assignGroupToSuperGroup(group.id, item.id); setIsSuperGroupPickerOpen(false); }} type="button"><SuperGroupIcon icon={item.icon} />{item.name}</Button>)}</div> : <p className="px-1.5 py-2 text-xs text-[#8d9b92]">Create an upper group first.</p>}</div> : null}
              </div>
              {group.superGroupId ? <Button aria-label="Remove group from upper group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#ffbdad] hover:bg-[#2c1917]" onClick={() => groupActions?.removeGroupFromSuperGroup(group.id)} title="Remove from upper group" type="button"><Unlink2 className="size-3.5" /></Button> : null}
              <label className="grid size-7 cursor-pointer place-items-center rounded border border-white/10 bg-black/10" title="Group color"><span className="sr-only">Group color</span><input aria-label="Group color" className="size-5 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => onSetGroupColor(event.target.value)} type="color" value={groupColor} /></label>
              <Button className="h-7 rounded border-white/10 bg-white/[0.05] px-2 text-xs text-[#d7e2da] hover:bg-white/10" onClick={onSaveGroup} type="button"><Save className="size-3.5" />Save group</Button>
              <Button aria-label="Add row to group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10" onClick={onAddRow} type="button"><Plus className="size-3.5" /></Button>
              <Button aria-label="Delete group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#ff9c8b] hover:bg-[#2c1917]" onClick={onDeleteGroup} type="button"><Trash2 className="size-3.5" /></Button>
            </div>
          </div>
        </div>
      </td>
    </tr>
    {!group.collapsed ? group.rows.map((row) => {
      const outputDistribution = estimateAutomationOutputDistribution([row]);
      const outputMix = describeExpectedOutputSourceMix(outputDistribution);
      const outputCostEstimate = estimateAutomationGroupCost([row]);
      return <tr className={cn("group cursor-grab border-b border-white/[0.075]", tone.row, isEffectivelyHidden && "opacity-60")} draggable key={row.id} onDragStart={() => onDragStart(row.id)} style={rowStyle}>
      <td className="relative border-r border-white/[0.075] px-2 py-2">{superGroup ? <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: groupAccentColor }} /> : null}<div className="flex items-center gap-1"><GripVertical className="size-3.5 text-[#617168]" /><input aria-label="Select automation row" className="accent-[#55c39a]" type="checkbox" /></div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-28 space-y-1.5">{CONTENT_TYPES.map((option) => <label className="flex items-center gap-1.5 text-xs text-[#d7e2da]" key={option.value}><input aria-label={`${option.label} content type`} checked={row.contentTypes.includes(option.value)} className="accent-[#55c39a]" onChange={() => onToggleContentType(group.id, row, option.value)} type="checkbox" />{option.label}</label>)}</div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-52 space-y-3">{row.contentTypes.map((contentType) => <GeneratorModeSelector contentType={contentType} generator={row.generators[contentType] ?? RANDOM_GENERATOR} key={contentType} onSelect={(generator) => onSelectGenerator(group.id, row, contentType, generator)} onToggleInclude={(include) => onToggleRandomInclude(group.id, row, contentType, include)} randomIncludes={row.randomIncludes[contentType]} />)}</div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><label className="block min-w-24"><span className="mb-1 block text-[10px] font-semibold text-[#8d9b92]">Outputs per day</span><select aria-label="Outputs per automation row" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { quantity: Number(event.target.value) })} value={row.quantity}>{CONTENT_QUANTITY_OPTIONS.map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}</select><span className="mt-1 block text-[10px] text-[#7f9086]">Expected: {outputMix}</span><span className="mt-0.5 block text-[10px] text-[#a9b8ae]">Est. {formatAutomationCostTry(outputCostEstimate.oneOffTry)}/day</span></label></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="grid grid-cols-3 gap-2"><AutomationLanguageSelect label="Learning language" onChange={(language) => onUpdateRow(group.id, row.id, { language })} value={row.language} /><AutomationLanguageSelect label="Native language" onChange={(nativeLanguage) => onUpdateRow(group.id, row.id, { nativeLanguage })} value={row.nativeLanguage} /><label className="space-y-1"><span className="block text-[10px] font-semibold text-[#8d9b92]">Tier</span><select aria-label="Tier" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { tier: event.target.value as TierSelection })} value={row.tier}><option value="random">Random</option>{TIERS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label></div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="flex min-w-40 flex-wrap gap-x-2 gap-y-1.5 px-1"><span className="w-full text-[10px] text-[#7f9086]">Post once to each selected network</span>{platformOptions.map((platform) => <label className="flex items-center gap-1 text-xs text-[#d7e2da]" key={platform.value}><input aria-label={`${platform.label} network`} checked={row.platforms.includes(platform.value)} className="accent-[#55c39a]" onChange={() => onTogglePlatform(group.id, row, platform.value)} type="checkbox" />{platform.label}</label>)}</div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-48 space-y-3 px-1">{row.platforms.map((platform) => <div className="space-y-1.5" key={platform}><p className="text-xs font-semibold text-[#a9b8ae]">{platformOptions.find((item) => item.value === platform)?.label}</p><div className="space-y-1.5">{getAccountsForPlatform(socialAccounts, platform).toSorted((first, second) => first.accountName.localeCompare(second.accountName)).map((account) => <label className="flex items-center gap-1.5 text-xs text-[#d7e2da]" key={account.id}><input aria-label={`${account.accountName} account`} checked={row.accounts[platform]?.includes(account.id) ?? false} className="accent-[#55c39a]" onChange={() => onToggleAccount(group.id, row, platform, account.id)} type="checkbox" /><span>{account.accountName}</span></label>)}</div></div>)}</div></td>
      <td className="border-r border-white/[0.075] px-2 py-2"><div className="flex items-center gap-1"><input aria-label="Schedule start time" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { scheduleStart: event.target.value })} type="time" value={row.scheduleStart} /><span className="text-[#718077]">to</span><input aria-label="Schedule end time" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { scheduleEnd: event.target.value })} type="time" value={row.scheduleEnd} /></div><p className="mt-1 px-1 text-[10px] text-[#7f9086]">Random publish time</p></td>
      <td className="border-r border-white/[0.075] px-3 py-2"><span className={cn("text-xs font-medium", row.saved ? "text-[#55c39a]" : "text-[#e2bc64]")}>{row.saved ? "saved" : "draft"}</span></td>
      <td className="px-2 py-2"><div className="flex gap-1"><Button aria-label="Save automation row" className="size-8 rounded border-transparent bg-transparent p-0 text-[#55c39a] hover:border-[#2b634a] hover:bg-[#15261d]" onClick={() => onSaveRow(group.id, row.id)} type="button"><Save className="size-3.5" /></Button><Button aria-label="Delete automation row" className="size-8 rounded border-transparent bg-transparent p-0 text-[#ff9c8b] hover:border-[#61352e] hover:bg-[#2c1917]" disabled={group.rows.length === 1} onClick={() => onDeleteRow(row.id)} type="button"><Trash2 className="size-3.5" /></Button></div></td>
    </tr>;
    }) : null}
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
