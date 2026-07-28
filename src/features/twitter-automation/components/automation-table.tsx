"use client";

import { ArrowLeft, ChevronDown, ChevronRight, Filter, FolderPlus, GripVertical, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { TIERS } from "@/data/tiers";
import { cn } from "@/lib/utils";
import type { LanguageCode, Tier } from "@/types/domain";

type ContentType = "random" | "text" | "image" | "video";
type Platform = "x" | "instagram" | "facebook" | "linkedin" | "tiktok";
type GroupTone = "emerald" | "blue" | "amber" | "rose";
type TierSelection = Tier | "random";
type SyncState = "loading" | "saved" | "saving" | "error";

interface AutomationRow {
  id: string;
  contentType: ContentType;
  generator: string;
  language: LanguageCode;
  nativeLanguage: LanguageCode;
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
  collapsed: boolean;
  rows: AutomationRow[];
}

const CONTENT_TYPES: Array<{ value: ContentType; label: string }> = [
  { value: "random", label: "Random" },
  { value: "text", label: "Text" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
];

const GENERATORS: Record<ContentType, Array<{ value: string; label: string }>> = {
  random: [{ value: "random-content", label: "Random content mode" }],
  text: [
    { value: "random-text", label: "Random text mode" },
    { value: "fun-post", label: "Fun FoxiesDeck Post" },
    { value: "word-quiz", label: "Word Quiz" },
    { value: "language-tip", label: "Language Tip" },
    { value: "false-friends", label: "False Friends" },
    { value: "daily-challenge", label: "Daily Challenge" },
    { value: "relatable-learner", label: "Relatable Learner Post" },
  ],
  image: [
    { value: "random-image", label: "Random image mode" },
    { value: "random-ai-image", label: "Random AI-generated image" },
    { value: "random-no-ai-image", label: "Random no-AI image" },
    { value: "word-of-the-day", label: "Word of the Day" },
    { value: "word-of-the-day-poster", label: "Word of the Day Poster" },
    { value: "ai-word-of-the-day", label: "AI Word of the Day" },
    { value: "ai-mini-quiz", label: "AI Mini Quiz" },
    { value: "ai-false-friends", label: "AI False Friends" },
    { value: "ai-daily-challenge", label: "AI Daily Challenge" },
    { value: "ai-vocabulary-progression", label: "AI Beginner to Advanced" },
  ],
  video: [
    { value: "random-video", label: "Random video mode" },
    { value: "ai-word-of-the-day-video", label: "AI Word of the Day Video" },
  ],
};

const PLATFORMS: Array<{ value: Platform; label: string }> = [
  { value: "x", label: "X" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "tiktok", label: "TikTok" },
];

// The account registry is intentionally local draft data until social account OAuth is connected.
const ACCOUNTS: Record<Platform, Array<{ value: string; label: string }>> = {
  x: [{ value: "x-foxiesdeck", label: "@foxiesdeck" }],
  instagram: [{ value: "instagram-foxiesdeck", label: "@foxiesdeck" }],
  facebook: [{ value: "facebook-foxiesdeck", label: "FoxiesDeck" }],
  linkedin: [{ value: "linkedin-foxiesdeck", label: "FoxiesDeck" }],
  tiktok: [{ value: "tiktok-foxiesdeck", label: "@foxiesdeck" }],
};

const GROUP_TONES: Record<GroupTone, { stripe: string; header: string; row: string; text: string }> = {
  emerald: { stripe: "bg-[#55c39a]", header: "bg-[#11251c]", row: "bg-[#101914]", text: "text-[#a9ecc8]" },
  blue: { stripe: "bg-[#62a9ef]", header: "bg-[#101f30]", row: "bg-[#10171f]", text: "text-[#b4d9ff]" },
  amber: { stripe: "bg-[#f0b849]", header: "bg-[#292112]", row: "bg-[#1a1710]", text: "text-[#f7d78d]" },
  rose: { stripe: "bg-[#ed7784]", header: "bg-[#2b151a]", row: "bg-[#1d1215]", text: "text-[#ffb9c1]" },
};

const TONE_ORDER: GroupTone[] = ["emerald", "blue", "amber", "rose"];
const LANGUAGE_OPTIONS = Object.values(LANGUAGE_BY_CODE);
const cellControlClassName = "h-8 w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 text-xs text-[#f7f3ed] outline-none transition-colors hover:bg-white/[0.045] focus:border-[#55c39a] focus:bg-[#111715]";

function createRow(): AutomationRow {
  return {
    id: crypto.randomUUID(),
    contentType: "text",
    generator: "random-text",
    language: "en",
    nativeLanguage: "en",
    tier: "random",
    platforms: ["x"],
    accounts: { x: [ACCOUNTS.x[0].value] },
    scheduleStart: "09:00",
    scheduleEnd: "18:00",
    saved: false,
  };
}

function createGroup(name: string, tone: GroupTone): AutomationGroup {
  return { id: crypto.randomUUID(), name, tone, collapsed: false, rows: [createRow()] };
}

function createInitialGroups() {
  return [createGroup("Word of the Day campaign", "emerald"), createGroup("AI visual campaign", "blue")];
}

function ColumnHeader({ label, type }: { label: string; type: string }) {
  return <th className="border-b border-r border-white/10 bg-[#171a19] px-3 py-2 text-left last:border-r-0"><span className="text-[11px] font-semibold text-[#e9f2ec]">{label}</span><span className="ml-1.5 text-[10px] text-[#7f9086]">{type}</span></th>;
}

function toggleItem<T>(items: readonly T[], item: T) {
  return items.includes(item) ? items.filter((entry) => entry !== item) : [...items, item];
}

export function AutomationTable({ onBack }: { onBack: () => void }) {
  const [groups, setGroups] = useState<AutomationGroup[]>(createInitialGroups);
  const [query, setQuery] = useState("");
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [draggedRow, setDraggedRow] = useState<{ groupId: string; rowId: string } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const saveRequestId = useRef(0);
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());
  const visibleGroups = groups.map((group) => ({
    ...group,
    rows: group.rows.filter((row) => !deferredQuery || [group.name, row.contentType, row.generator, row.platforms.join(" "), Object.values(row.accounts).flat().join(" "), row.language, row.nativeLanguage, row.tier].join(" ").toLocaleLowerCase().includes(deferredQuery)),
  })).filter((group) => group.rows.length > 0 || !deferredQuery);
  const rowCount = groups.reduce((total, group) => total + group.rows.length, 0);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/twitter-automation/automations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Automation state could not be loaded.");
        return response.json() as Promise<{ groups?: AutomationGroup[] }>;
      })
      .then((payload) => {
        if (cancelled) return;
        if (Array.isArray(payload.groups) && payload.groups.length > 0) setGroups(payload.groups);
        setSyncState("saved");
      })
      .catch(() => {
        if (!cancelled) setSyncState("error");
      })
      .finally(() => {
        if (!cancelled) setIsHydrated(true);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    const timeout = window.setTimeout(() => {
      const requestId = ++saveRequestId.current;
      setSyncState("saving");
      void fetch("/api/twitter-automation/automations", {
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
  }, [groups, isHydrated]);

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

  function selectContentType(groupId: string, row: AutomationRow, contentType: ContentType) {
    updateRow(groupId, row.id, { contentType, generator: GENERATORS[contentType][0].value });
  }

  function togglePlatform(groupId: string, row: AutomationRow, platform: Platform) {
    const platforms = toggleItem(row.platforms, platform);
    if (!platforms.length) return;
    const accounts = { ...row.accounts };
    if (platforms.includes(platform) && !accounts[platform]?.length) accounts[platform] = [ACCOUNTS[platform][0].value];
    if (!platforms.includes(platform)) delete accounts[platform];
    updateRow(groupId, row.id, { platforms, accounts });
  }

  function toggleAccount(groupId: string, row: AutomationRow, platform: Platform, account: string) {
    const selectedAccounts = toggleItem(row.accounts[platform] ?? [], account);
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

  return <section className="flex min-h-[calc(100dvh-4rem)] flex-col bg-[#101212] text-[#f7f3ed]">
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#171a19] px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3"><Button aria-label="Back to content studio" className="size-8 shrink-0 rounded border-white/10 bg-transparent p-0 text-[#d7e2da] hover:bg-white/[0.06]" onClick={onBack} type="button"><ArrowLeft className="size-4" /></Button><div className="min-w-0"><p className="truncate text-sm font-semibold">Content automation</p><p className="truncate text-xs text-[#8d9b92]">automation_queue</p></div></div>
      <div className="hidden items-center gap-2 text-xs text-[#829287] sm:flex"><span className={cn("size-2 rounded-full", syncState === "error" ? "bg-[#ed7784]" : syncState === "saving" || syncState === "loading" ? "bg-[#f0b849]" : "bg-[#55c39a]")} />{syncState === "loading" ? "Loading automation" : syncState === "saving" ? "Saving to Supabase" : syncState === "error" ? "Supabase unavailable" : "Saved to Supabase"}</div>
      <div className="flex shrink-0 gap-2"><Button className="h-8 rounded border-white/10 bg-white/[0.045] px-3 text-xs text-[#d7e2da] hover:bg-white/[0.09]" onClick={() => setGroups((current) => [...current, createGroup(`New campaign ${current.length + 1}`, TONE_ORDER[current.length % TONE_ORDER.length])])} type="button"><FolderPlus className="size-3.5" />New group</Button><Button className="h-8 rounded border-[#299d6d] bg-[#299d6d] px-3 text-xs text-white hover:bg-[#36ad79]" onClick={() => setGroups((current) => current.map((group, index) => index === 0 ? { ...group, rows: [...group.rows, createRow()] } : group))} type="button"><Plus className="size-3.5" />Insert row</Button></div>
    </header>
    <div className="flex shrink-0 flex-col gap-2 border-b border-white/10 bg-[#141716] px-3 py-2 sm:flex-row sm:items-center sm:px-5"><label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-white/10 bg-[#101212] px-2.5 text-[#8d9b92] focus-within:border-[#55c39a] sm:max-w-xl"><Search className="size-4 shrink-0" /><input className="min-w-0 flex-1 bg-transparent text-xs text-[#f7f3ed] outline-none placeholder:text-[#718077]" onChange={(event) => setQuery(event.target.value)} placeholder="Filter by campaign, mode, language, platform, account..." value={query} /></label><div className="flex items-center gap-2"><span className="inline-flex h-8 items-center gap-1.5 px-2 text-xs text-[#a9b8ae]"><Filter className="size-3.5" />{rowCount} rows · {groups.length} groups</span><span className="text-xs text-[#718077]">Execution disabled</span></div></div>
    <div className="min-h-0 flex-1 overflow-auto"><table className="min-w-[1510px] w-full border-collapse text-left"><thead className="sticky top-0 z-20"><tr><th className="w-11 border-b border-r border-white/10 bg-[#171a19] px-3 py-2"><input aria-label="Select all rows" className="accent-[#55c39a]" type="checkbox" /></th><ColumnHeader label="content_type" type="enum" /><ColumnHeader label="generator_mode" type="text" /><ColumnHeader label="parameters" type="json" /><ColumnHeader label="social_networks" type="array" /><ColumnHeader label="social_accounts" type="array" /><ColumnHeader label="schedule_window" type="time range" /><ColumnHeader label="state" type="text" /><th className="w-24 border-b border-white/10 bg-[#171a19] px-3 py-2" /></tr></thead><tbody>{visibleGroups.map((group) => <GroupRows group={group} isRenaming={renamingGroupId === group.id} key={group.id} onAddRow={() => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, rows: [...item.rows, createRow()] } : item))} onDeleteGroup={() => setGroups((current) => current.length === 1 ? current : current.filter((item) => item.id !== group.id))} onDragOver={(event) => event.preventDefault()} onDrop={() => moveRow(group.id)} onRename={(name) => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, name } : item))} onRenameFinish={() => setRenamingGroupId(null)} onRenameStart={() => setRenamingGroupId(group.id)} onToggle={() => setGroups((current) => current.map((item) => item.id === group.id ? { ...item, collapsed: !item.collapsed } : item))} onUpdateRow={updateRow} onSaveRow={saveRow} onSelectContentType={selectContentType} onToggleAccount={toggleAccount} onTogglePlatform={togglePlatform} onDeleteRow={(rowId) => setGroups((current) => current.map((item) => item.id !== group.id ? item : { ...item, rows: item.rows.filter((row) => row.id !== rowId) }))} onDragStart={(rowId) => setDraggedRow({ groupId: group.id, rowId })} tone={GROUP_TONES[group.tone]} />)}</tbody></table>{!visibleGroups.length ? <div className="grid min-h-48 place-items-center border-b border-white/[0.075] text-sm text-[#8d9b92]">No automation rows match this filter.</div> : null}</div>
    <footer className="flex min-h-10 shrink-0 items-center justify-between border-t border-white/10 bg-[#171a19] px-3 text-xs text-[#829287] sm:px-5"><span>Changes save automatically. Each execution picks one random mode, tier, and time inside the saved window.</span><span>{rowCount} total</span></footer>
  </section>;
}

type ToneStyle = (typeof GROUP_TONES)[GroupTone];

interface GroupRowsProps {
  group: AutomationGroup;
  tone: ToneStyle;
  isRenaming: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onRenameStart: () => void;
  onRenameFinish: () => void;
  onAddRow: () => void;
  onDeleteGroup: () => void;
  onDragOver: (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop: () => void;
  onUpdateRow: (groupId: string, rowId: string, update: Partial<AutomationRow>) => void;
  onSaveRow: (groupId: string, rowId: string) => void;
  onSelectContentType: (groupId: string, row: AutomationRow, contentType: ContentType) => void;
  onTogglePlatform: (groupId: string, row: AutomationRow, platform: Platform) => void;
  onToggleAccount: (groupId: string, row: AutomationRow, platform: Platform, account: string) => void;
  onDeleteRow: (rowId: string) => void;
  onDragStart: (rowId: string) => void;
}

function GroupRows({ group, tone, isRenaming, onToggle, onRename, onRenameStart, onRenameFinish, onAddRow, onDeleteGroup, onDragOver, onDrop, onUpdateRow, onSaveRow, onSelectContentType, onTogglePlatform, onToggleAccount, onDeleteRow, onDragStart }: GroupRowsProps) {
  return <>
    <tr className={cn("group-header relative border-y border-white/10", tone.header)} onDragOver={onDragOver} onDrop={onDrop}><td className="relative p-0" colSpan={9}><span className={cn("absolute inset-y-0 left-0 w-1", tone.stripe)} /><div className="flex h-12 items-center justify-between gap-3 px-4 pl-5"><div className="flex min-w-0 items-center gap-2"><Button aria-label={group.collapsed ? "Expand group" : "Collapse group"} className="size-7 shrink-0 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10" onClick={onToggle} type="button">{group.collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}</Button>{isRenaming ? <input autoFocus aria-label="Campaign name" className={cn("min-w-0 max-w-64 border-b border-current bg-transparent text-sm font-semibold outline-none", tone.text)} onBlur={onRenameFinish} onChange={(event) => onRename(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") event.currentTarget.blur(); }} value={group.name} /> : <button className={cn("max-w-64 truncate text-left text-sm font-semibold", tone.text)} onClick={onRenameStart} type="button">{group.name}</button>}<Button aria-label="Rename group" className="size-7 shrink-0 rounded border-transparent bg-transparent p-0 text-[#aab7af] hover:bg-white/10 hover:text-white" onClick={onRenameStart} type="button"><Pencil className="size-3.5" /></Button><span className="shrink-0 text-xs text-[#93a39a]">{group.rows.length} rows</span></div><div className="flex shrink-0 items-center gap-1"><span className="mr-2 text-xs text-[#829287]">Drop rows here</span><Button aria-label="Add row to group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#d7e2da] hover:bg-white/10" onClick={onAddRow} type="button"><Plus className="size-3.5" /></Button><Button aria-label="Delete group" className="size-7 rounded border-transparent bg-transparent p-0 text-[#ff9c8b] hover:bg-[#2c1917]" onClick={onDeleteGroup} type="button"><Trash2 className="size-3.5" /></Button></div></div></td></tr>
    {!group.collapsed ? group.rows.map((row) => <tr className={cn("group cursor-grab border-b border-white/[0.075]", tone.row)} draggable key={row.id} onDragStart={() => onDragStart(row.id)}><td className="border-r border-white/[0.075] px-2 py-2"><div className="flex items-center gap-1"><GripVertical className="size-3.5 text-[#617168]" /><input aria-label="Select automation row" className="accent-[#55c39a]" type="checkbox" /></div></td><td className="border-r border-white/[0.075] px-2 py-2"><select aria-label="Content type" className={cellControlClassName} onChange={(event) => onSelectContentType(group.id, row, event.target.value as ContentType)} value={row.contentType}>{CONTENT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td className="border-r border-white/[0.075] px-2 py-2"><select aria-label="Generator mode" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { generator: event.target.value })} value={row.generator}>{GENERATORS[row.contentType].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="grid grid-cols-3 gap-1"><select aria-label="Learning language" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { language: event.target.value as LanguageCode })} value={row.language}>{LANGUAGE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.code.toUpperCase()}</option>)}</select><select aria-label="Native language" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { nativeLanguage: event.target.value as LanguageCode })} value={row.nativeLanguage}>{LANGUAGE_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.code.toUpperCase()}</option>)}</select><select aria-label="Tier" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { tier: event.target.value as TierSelection })} value={row.tier}><option value="random">Random</option>{TIERS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="flex min-w-40 flex-wrap gap-x-2 gap-y-1.5 px-1"><span className="w-full text-[10px] text-[#7f9086]">Post once to each selected network</span>{PLATFORMS.map((platform) => <label className="flex items-center gap-1 text-xs text-[#d7e2da]" key={platform.value}><input aria-label={`${platform.label} network`} checked={row.platforms.includes(platform.value)} className="accent-[#55c39a]" onChange={() => onTogglePlatform(group.id, row, platform.value)} type="checkbox" />{platform.label}</label>)}</div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="min-w-48 space-y-1.5 px-1">{row.platforms.map((platform) => <div className="flex flex-wrap items-center gap-x-2 gap-y-1" key={platform}><span className="w-16 text-[10px] text-[#7f9086]">{PLATFORMS.find((item) => item.value === platform)?.label}</span>{ACCOUNTS[platform].map((account) => <label className="flex items-center gap-1 text-xs text-[#d7e2da]" key={account.value}><input aria-label={`${account.label} account`} checked={row.accounts[platform]?.includes(account.value) ?? false} className="accent-[#55c39a]" onChange={() => onToggleAccount(group.id, row, platform, account.value)} type="checkbox" />{account.label}</label>)}</div>)}</div></td><td className="border-r border-white/[0.075] px-2 py-2"><div className="flex items-center gap-1"><input aria-label="Schedule start time" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { scheduleStart: event.target.value })} type="time" value={row.scheduleStart} /><span className="text-[#718077]">to</span><input aria-label="Schedule end time" className={cellControlClassName} onChange={(event) => onUpdateRow(group.id, row.id, { scheduleEnd: event.target.value })} type="time" value={row.scheduleEnd} /></div><p className="mt-1 px-1 text-[10px] text-[#7f9086]">Random publish time</p></td><td className="border-r border-white/[0.075] px-3 py-2"><span className={cn("text-xs font-medium", row.saved ? "text-[#55c39a]" : "text-[#e2bc64]")}>{row.saved ? "saved" : "draft"}</span></td><td className="px-2 py-2"><div className="flex gap-1"><Button aria-label="Save automation row" className="size-8 rounded border-transparent bg-transparent p-0 text-[#55c39a] hover:border-[#2b634a] hover:bg-[#15261d]" onClick={() => onSaveRow(group.id, row.id)} type="button"><Save className="size-3.5" /></Button><Button aria-label="Delete automation row" className="size-8 rounded border-transparent bg-transparent p-0 text-[#ff9c8b] hover:border-[#61352e] hover:bg-[#2c1917]" disabled={group.rows.length === 1} onClick={() => onDeleteRow(row.id)} type="button"><Trash2 className="size-3.5" /></Button></div></td></tr>) : null}
  </>;
}
