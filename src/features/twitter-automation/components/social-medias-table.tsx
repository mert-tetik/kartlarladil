"use client";

import { ArrowDown, ArrowDownUp, ArrowLeft, ArrowUp, Check, CircleAlert, Database, Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SocialMediaAccount = {
  id: number;
  "Social Media": string | null;
  "Account Name": string | null;
  "upload-post profile username": string | null;
  description: string | null;
};

type AccountDraft = {
  socialMedia: string;
  accountName: string;
  uploadPostProfileUsername: string;
  description: string;
};

type SyncState = "loading" | "ready" | "saving" | "error";
type SortKey = "id" | "socialMedia" | "accountName" | "uploadPostProfileUsername" | "description";
type SortDirection = "asc" | "desc";

const EMPTY_DRAFT: AccountDraft = { socialMedia: "", accountName: "", uploadPostProfileUsername: "", description: "" };
const TEXT_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function toDraft(account: SocialMediaAccount): AccountDraft {
  return {
    socialMedia: account["Social Media"] ?? "",
    accountName: account["Account Name"] ?? "",
    uploadPostProfileUsername: account["upload-post profile username"] ?? "",
    description: account.description ?? "",
  };
}

function getErrorMessage(errorCode: string | undefined) {
  const messages: Record<string, string> = {
    invalid_social_media: "Platform, account name, and Upload-Post profile username are required. Description can contain up to 2,000 characters.",
    social_media_not_found: "This account no longer exists. Refresh the table and try again.",
    social_media_in_use: "This account is connected to social publishing records and cannot be deleted.",
    social_medias_unavailable: "Supabase could not load social_medias.",
    social_media_create_failed: "The account could not be created in Supabase.",
    social_media_update_failed: "The account could not be saved to Supabase.",
    social_media_delete_failed: "The account could not be deleted from Supabase.",
  };
  return messages[errorCode ?? ""] ?? "Supabase could not complete this request.";
}

function SortableColumnHeader({ label, sortKey, sort, onSort }: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; direction: SortDirection };
  onSort: (key: SortKey) => void;
}) {
  const isActive = sort.key === sortKey;
  const Icon = !isActive ? ArrowDownUp : sort.direction === "asc" ? ArrowUp : ArrowDown;
  const nextDirection = isActive && sort.direction === "asc" ? "descending" : "ascending";

  return <th aria-sort={isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className="border-b border-r border-white/10 bg-[#171a19] p-0 text-xs font-semibold text-[#a9b8ae]"><button aria-label={`Sort by ${label} ${nextDirection}`} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.06] hover:text-[#f7f3ed]", isActive && "text-[#a9ecc8]")} onClick={() => onSort(sortKey)} type="button">{label}<Icon className="size-3.5" aria-hidden="true" /></button></th>;
}

export function SocialMediasTable({ onBack, onOpenAutomations }: { onBack: () => void; onOpenAutomations: () => void }) {
  const [accounts, setAccounts] = useState<SocialMediaAccount[]>([]);
  const [drafts, setDrafts] = useState<Record<number, AccountDraft>>({});
  const [newAccount, setNewAccount] = useState<AccountDraft>(EMPTY_DRAFT);
  const [query, setQuery] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [activeId, setActiveId] = useState<number | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "id", direction: "asc" });
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase());

  async function loadAccounts() {
    setSyncState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/twitter-automation/social-medias", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { accounts?: SocialMediaAccount[]; errorCode?: string } | null;
      if (!response.ok) throw new Error(getErrorMessage(payload?.errorCode));
      const nextAccounts = Array.isArray(payload?.accounts) ? payload.accounts : [];
      setAccounts(nextAccounts);
      setDrafts(Object.fromEntries(nextAccounts.map((account) => [account.id, toDraft(account)])));
      setSyncState("ready");
    } catch (error) {
      setSyncState("error");
      setMessage(error instanceof Error ? error.message : "Supabase could not load social_medias.");
    }
  }

  useEffect(() => {
    const loadTimer = window.setTimeout(() => void loadAccounts(), 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  const visibleAccounts = useMemo(() => accounts.filter((account) => {
    if (!deferredQuery) return true;
    return [account.id, account["Social Media"], account["Account Name"], account["upload-post profile username"], account.description]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(deferredQuery));
  }).sort((first, second) => {
    const firstValue = sort.key === "id" ? first.id : sort.key === "socialMedia" ? first["Social Media"] ?? "" : sort.key === "accountName" ? first["Account Name"] ?? "" : sort.key === "uploadPostProfileUsername" ? first["upload-post profile username"] ?? "" : first.description ?? "";
    const secondValue = sort.key === "id" ? second.id : sort.key === "socialMedia" ? second["Social Media"] ?? "" : sort.key === "accountName" ? second["Account Name"] ?? "" : sort.key === "uploadPostProfileUsername" ? second["upload-post profile username"] ?? "" : second.description ?? "";
    const comparison = sort.key === "id" ? Number(firstValue) - Number(secondValue) : TEXT_COLLATOR.compare(String(firstValue), String(secondValue));
    return sort.direction === "asc" ? comparison : -comparison;
  }), [accounts, deferredQuery, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  }

  function updateDraft(id: number, update: Partial<AccountDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? EMPTY_DRAFT), ...update } }));
  }

  async function createAccount() {
    setActiveId("new");
    setMessage("");
    setSyncState("saving");
    try {
      const response = await fetch("/api/twitter-automation/social-medias", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...newAccount, description: newAccount.description.trim() || null }),
      });
      const payload = await response.json().catch(() => null) as { account?: SocialMediaAccount; errorCode?: string } | null;
      if (!response.ok || !payload?.account) throw new Error(getErrorMessage(payload?.errorCode));
      setAccounts((current) => [...current, payload.account!]);
      setDrafts((current) => ({ ...current, [payload.account!.id]: toDraft(payload.account!) }));
      setNewAccount(EMPTY_DRAFT);
      setMessage("Account created in Supabase.");
      setSyncState("ready");
    } catch (error) {
      setSyncState("error");
      setMessage(error instanceof Error ? error.message : "The account could not be created in Supabase.");
    } finally {
      setActiveId(null);
    }
  }

  async function saveAccount(id: number) {
    const draft = drafts[id] ?? EMPTY_DRAFT;
    setActiveId(id);
    setMessage("");
    setSyncState("saving");
    try {
      const response = await fetch("/api/twitter-automation/social-medias", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, ...draft, description: draft.description.trim() || null }),
      });
      const payload = await response.json().catch(() => null) as { account?: SocialMediaAccount; errorCode?: string } | null;
      if (!response.ok || !payload?.account) throw new Error(getErrorMessage(payload?.errorCode));
      setAccounts((current) => current.map((account) => account.id === id ? payload.account! : account));
      setDrafts((current) => ({ ...current, [id]: toDraft(payload.account!) }));
      setMessage(`Account #${id} saved to Supabase.`);
      setSyncState("ready");
    } catch (error) {
      setSyncState("error");
      setMessage(error instanceof Error ? error.message : "The account could not be saved to Supabase.");
    } finally {
      setActiveId(null);
    }
  }

  async function deleteAccount(account: SocialMediaAccount) {
    const name = account["Account Name"] || `account #${account.id}`;
    if (!window.confirm(`Delete ${name} from social_medias? This cannot be undone.`)) return;

    setActiveId(account.id);
    setMessage("");
    setSyncState("saving");
    try {
      const response = await fetch(`/api/twitter-automation/social-medias?id=${encodeURIComponent(account.id)}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null) as { deletedId?: number; errorCode?: string } | null;
      if (!response.ok || payload?.deletedId !== account.id) throw new Error(getErrorMessage(payload?.errorCode));
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setDrafts((current) => {
        const next = { ...current };
        delete next[account.id];
        return next;
      });
      setMessage(`Account #${account.id} deleted from Supabase.`);
      setSyncState("ready");
    } catch (error) {
      setSyncState("error");
      setMessage(error instanceof Error ? error.message : "The account could not be deleted from Supabase.");
    } finally {
      setActiveId(null);
    }
  }

  const statusLabel = syncState === "loading" ? "Loading from Supabase" : syncState === "saving" ? "Saving to Supabase" : syncState === "error" ? "Supabase error" : "Live Supabase data";

  return <section className="content-automation-shell flex min-h-[calc(100dvh-4rem)] flex-col bg-[#101212] text-[#f7f3ed]">
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#171a19] px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button aria-label="Back to content studio" className="size-8 shrink-0 rounded border-white/10 bg-transparent p-0 text-[#d7e2da] hover:bg-white/[0.06]" onClick={onBack} type="button"><ArrowLeft className="size-4" /></Button>
        <div className="min-w-0"><p className="truncate text-sm font-semibold">Content automation</p><p className="truncate text-xs text-[#8d9b92]">public.social_medias</p></div>
      </div>
      <div className="hidden items-center gap-2 text-xs text-[#829287] sm:flex"><span className={cn("size-2 rounded-full", syncState === "error" ? "bg-[#ed7784]" : syncState === "loading" || syncState === "saving" ? "bg-[#f0b849]" : "bg-[#55c39a]")} />{statusLabel}</div>
      <Button className="h-8 rounded border-transparent bg-[#c7f05d] px-3 text-xs text-black hover:bg-[#d6ff73]" onClick={onOpenAutomations} type="button">Automation table</Button>
    </header>

    <div className="flex shrink-0 flex-col gap-3 border-b border-white/10 bg-[#141716] px-3 py-3 sm:flex-row sm:items-center sm:px-5">
      <label className="flex h-9 min-w-0 flex-1 items-center gap-2 border border-white/10 bg-[#101212] px-2.5 text-[#8d9b92] focus-within:border-[#55c39a] sm:max-w-xl"><Search className="size-4 shrink-0" /><input className="min-w-0 flex-1 bg-transparent text-xs text-[#f7f3ed] outline-none placeholder:text-[#718077]" onChange={(event) => setQuery(event.target.value)} placeholder="Filter by platform, account, profile, description, or id..." value={query} /></label>
      <div className="flex items-center gap-2"><span className="inline-flex h-8 items-center gap-1.5 px-2 text-xs text-[#a9b8ae]"><Database className="size-3.5" />{accounts.length} accounts</span><Button aria-label="Refresh social media accounts" className="size-8 rounded border-white/10 bg-transparent p-0 text-[#d7e2da] hover:bg-white/[0.06]" disabled={syncState === "loading" || syncState === "saving"} onClick={() => void loadAccounts()} type="button"><RefreshCw className={cn("size-3.5", syncState === "loading" && "animate-spin")} /></Button></div>
    </div>

    <div className="min-h-0 flex-1 overflow-auto">
      <table className="min-w-[1180px] w-full border-collapse text-left">
        <thead className="sticky top-0 z-20"><tr><SortableColumnHeader label="id" onSort={toggleSort} sort={sort} sortKey="id" /><SortableColumnHeader label="Social Media" onSort={toggleSort} sort={sort} sortKey="socialMedia" /><SortableColumnHeader label="Account Name" onSort={toggleSort} sort={sort} sortKey="accountName" /><SortableColumnHeader label="Upload-Post profile" onSort={toggleSort} sort={sort} sortKey="uploadPostProfileUsername" /><SortableColumnHeader label="description" onSort={toggleSort} sort={sort} sortKey="description" /><th className="w-24 border-b border-white/10 bg-[#171a19] px-3 py-2" /></tr></thead>
        <tbody>
          <tr className="border-b border-white/[0.075] bg-[#162017]"><td className="border-r border-white/[0.075] px-3 py-2 text-xs text-[#7f9086]">new</td><td className="border-r border-white/[0.075] p-2"><input aria-label="New social media platform" className="h-9 w-full rounded border border-[#2b634a] bg-[#101914] px-2 text-sm text-white outline-none placeholder:text-[#607166] focus:border-[#55c39a]" maxLength={120} onChange={(event) => setNewAccount((current) => ({ ...current, socialMedia: event.target.value }))} placeholder="Instagram" value={newAccount.socialMedia} /></td><td className="border-r border-white/[0.075] p-2"><input aria-label="New social media account name" className="h-9 w-full rounded border border-[#2b634a] bg-[#101914] px-2 text-sm text-white outline-none placeholder:text-[#607166] focus:border-[#55c39a]" maxLength={160} onChange={(event) => setNewAccount((current) => ({ ...current, accountName: event.target.value }))} placeholder="@foxiesdeck" value={newAccount.accountName} /></td><td className="border-r border-white/[0.075] p-2"><input aria-label="New Upload-Post profile username" className="h-9 w-full rounded border border-[#2b634a] bg-[#101914] px-2 text-sm text-white outline-none placeholder:text-[#607166] focus:border-[#55c39a]" maxLength={160} onChange={(event) => setNewAccount((current) => ({ ...current, uploadPostProfileUsername: event.target.value }))} placeholder="Upload-Post profile username" value={newAccount.uploadPostProfileUsername} /></td><td className="border-r border-white/[0.075] p-2"><input aria-label="New social media description" className="h-9 w-full rounded border border-[#2b634a] bg-[#101914] px-2 text-sm text-white outline-none placeholder:text-[#607166] focus:border-[#55c39a]" maxLength={2_000} onChange={(event) => setNewAccount((current) => ({ ...current, description: event.target.value }))} placeholder="Optional internal note" value={newAccount.description} /></td><td className="px-2 py-2"><Button aria-label="Create social media account" className="size-8 rounded border-transparent bg-transparent p-0 text-[#9be0b9] hover:border-[#2b634a] hover:bg-[#15261d]" disabled={activeId !== null || syncState === "loading"} onClick={() => void createAccount()} type="button">{activeId === "new" ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-4" />}</Button></td></tr>
          {visibleAccounts.map((account) => {
            const draft = drafts[account.id] ?? toDraft(account);
            const isActive = activeId === account.id;
            return <tr className="border-b border-white/[0.075] bg-[#101212]" key={account.id}><td className="border-r border-white/[0.075] px-3 py-2 font-mono text-xs text-[#7f9086]">{account.id}</td><td className="border-r border-white/[0.075] p-2"><input aria-label={`Social media platform for account ${account.id}`} className="h-9 w-full rounded border border-transparent bg-transparent px-2 text-sm text-[#f7f3ed] outline-none hover:bg-white/[0.045] focus:border-[#55c39a] focus:bg-[#111715]" disabled={isActive} maxLength={120} onChange={(event) => updateDraft(account.id, { socialMedia: event.target.value })} value={draft.socialMedia} /></td><td className="border-r border-white/[0.075] p-2"><input aria-label={`Account name for account ${account.id}`} className="h-9 w-full rounded border border-transparent bg-transparent px-2 text-sm text-[#f7f3ed] outline-none hover:bg-white/[0.045] focus:border-[#55c39a] focus:bg-[#111715]" disabled={isActive} maxLength={160} onChange={(event) => updateDraft(account.id, { accountName: event.target.value })} value={draft.accountName} /></td><td className="border-r border-white/[0.075] p-2"><input aria-label={`Upload-Post profile username for account ${account.id}`} className="h-9 w-full rounded border border-transparent bg-transparent px-2 text-sm text-[#f7f3ed] outline-none hover:bg-white/[0.045] focus:border-[#55c39a] focus:bg-[#111715]" disabled={isActive} maxLength={160} onChange={(event) => updateDraft(account.id, { uploadPostProfileUsername: event.target.value })} value={draft.uploadPostProfileUsername} /></td><td className="border-r border-white/[0.075] p-2"><input aria-label={`Description for account ${account.id}`} className="h-9 w-full rounded border border-transparent bg-transparent px-2 text-sm text-[#d7e2da] outline-none hover:bg-white/[0.045] focus:border-[#55c39a] focus:bg-[#111715]" disabled={isActive} maxLength={2_000} onChange={(event) => updateDraft(account.id, { description: event.target.value })} value={draft.description} /></td><td className="px-2 py-2"><div className="flex gap-1"><Button aria-label={`Save account ${account.id}`} className="size-8 rounded border-transparent bg-transparent p-0 text-[#9be0b9] hover:border-[#2b634a] hover:bg-[#15261d]" disabled={activeId !== null || syncState === "loading"} onClick={() => void saveAccount(account.id)} type="button">{isActive ? <RefreshCw className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}</Button><Button aria-label={`Delete account ${account.id}`} className="size-8 rounded border-transparent bg-transparent p-0 text-[#ff9c8b] hover:border-[#61352e] hover:bg-[#2c1917]" disabled={activeId !== null || syncState === "loading"} onClick={() => void deleteAccount(account)} type="button"><Trash2 className="size-3.5" /></Button></div></td></tr>;
          })}
        </tbody>
      </table>
      {syncState === "loading" ? <div className="grid min-h-48 place-items-center text-sm text-[#8d9b92]"><RefreshCw className="mr-2 inline size-4 animate-spin" />Loading social_medias...</div> : !visibleAccounts.length ? <div className="grid min-h-48 place-items-center text-sm text-[#8d9b92]">{accounts.length ? "No accounts match this filter." : "No social media accounts yet. Create the first row above."}</div> : null}
    </div>

    <footer className="flex min-h-11 shrink-0 items-center justify-between gap-4 border-t border-white/10 bg-[#171a19] px-3 text-xs sm:px-5"><span className="flex min-w-0 items-center gap-2 text-[#829287]">{syncState === "error" ? <CircleAlert className="size-3.5 shrink-0 text-[#ed7784]" /> : <Check className="size-3.5 shrink-0 text-[#55c39a]" />}{message || "Every create, update, and delete request is saved directly to Supabase."}</span><span className="shrink-0 text-[#829287]">{visibleAccounts.length} shown</span></footer>
  </section>;
}
