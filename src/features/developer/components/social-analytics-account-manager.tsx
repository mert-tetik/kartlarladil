"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Edit3, ExternalLink, LoaderCircle, Plus, Send, Trash2, X } from "lucide-react";
import type { SocialAnalyticsAccount, SocialAnalyticsData, SocialAnalyticsMetrics, SocialAnalyticsPost } from "@/features/developer/social-analytics-types";
import { getSocialPlatformTheme, SocialPlatformBrandIcon } from "@/features/developer/components/social-platform-brand";
import { SocialPostComposerOverlay } from "@/features/developer/components/social-post-composer-overlay";
import { getSocialProfileUrl } from "@/features/developer/social-profile-url";

const numberFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export const SOCIAL_ANALYTICS_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "x",
  "linkedin",
  "threads",
  "pinterest",
  "reddit",
  "bluesky",
  "google_business",
] as const;

const SUPPORTED_PLATFORMS = new Set<string>(SOCIAL_ANALYTICS_PLATFORMS);

type DatabaseAccount = {
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

type PostStateView = {
  posts: SocialAnalyticsPost[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
  error: string;
};

type Props = {
  data: SocialAnalyticsData;
  platformFilter: string;
  onPlatformFilterChange: (platform: string) => void;
  onDataChange: Dispatch<SetStateAction<SocialAnalyticsData>>;
  postStates: Record<number, PostStateView>;
  expandedAccounts: Record<number, boolean>;
  toggleAccountPosts: (accountId: number) => void;
  loadAccountPosts: (accountId: number, cursor?: string | null) => void | Promise<void>;
  renderPostCard: (post: SocialAnalyticsPost) => ReactNode;
};

const EMPTY_DRAFT: AccountDraft = {
  socialMedia: "",
  accountName: "",
  uploadPostProfileUsername: "",
  description: "",
};

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : numberFormatter.format(value);
}

function platformLabel(platform: string) {
  const labels: Record<string, string> = {
    x: "X",
    youtube: "YouTube",
    instagram: "Instagram",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
    facebook: "Facebook",
    threads: "Threads",
    pinterest: "Pinterest",
    reddit: "Reddit",
    bluesky: "Bluesky",
    google_business: "Google Business",
  };
  return labels[platform] ?? platform;
}

function normalizePlatform(value: string) {
  const normalized = value.trim().toLocaleLowerCase().replace(/[()]/gu, "").replace(/[\s./-]+/gu, "_");
  const aliases: Record<string, string> = {
    twitter: "x",
    twitter_x: "x",
    x_twitter: "x",
    youtube_shorts: "youtube",
    google_business_profile: "google_business",
    google_my_business: "google_business",
  };
  return aliases[normalized] ?? normalized;
}

function statusLabel(account: SocialAnalyticsAccount) {
  if (account.status === "live") return "Canlı veri";
  if (account.status === "not_configured") return "API anahtarı eksik";
  if (account.status === "profile_required") return "Profil eşleşmesi eksik";
  if (account.status === "unsupported") return "Analytics desteklenmiyor";
  return "Veri alınamadı";
}

function statusClasses(status: SocialAnalyticsAccount["status"]) {
  if (status === "live") return "bg-[#e3f1e6] text-[#287148]";
  if (status === "unsupported") return "bg-[#eef0f3] text-[#5f6974]";
  if (status === "error") return "bg-[#fff1ed] text-[#8b3b2b]";
  return "bg-[#fff0df] text-[#9b5b14]";
}

function sumMetric(accounts: SocialAnalyticsAccount[], selector: (metrics: SocialAnalyticsMetrics) => number | null) {
  return accounts.reduce((total, account) => total + (account.metrics ? selector(account.metrics) ?? 0 : 0), 0);
}

function createSummary(accounts: SocialAnalyticsAccount[], previous: SocialAnalyticsData["summary"]) {
  const numeric = (selector: (metrics: SocialAnalyticsMetrics) => number | null) => accounts.reduce((sum, account) => sum + (account.metrics ? selector(account.metrics) ?? 0 : 0), 0);
  return {
    ...previous,
    totalAccounts: accounts.length,
    profileReadyAccounts: accounts.filter((account) => Boolean(account.profileUsername)).length,
    liveAccounts: accounts.filter((account) => account.status === "live").length,
    errorAccounts: accounts.filter((account) => account.status === "error").length,
    unsupportedAccounts: accounts.filter((account) => account.status === "unsupported").length,
    totalFollowers: numeric((metrics) => metrics.followers),
    totalReach: numeric((metrics) => metrics.reach),
    totalViews: numeric((metrics) => metrics.views ?? metrics.impressions),
    totalEngagement: numeric((metrics) => metrics.engagement),
    totalPosts: numeric((metrics) => metrics.postsCount),
  };
}

function accountStatus(platform: string, profileUsername: string, configured: boolean): SocialAnalyticsAccount["status"] {
  if (!configured) return "not_configured";
  if (!profileUsername.trim()) return "profile_required";
  if (!SUPPORTED_PLATFORMS.has(normalizePlatform(platform))) return "unsupported";
  return "live";
}

function statusMessage(status: SocialAnalyticsAccount["status"]) {
  if (status === "not_configured") return "UPLOAD_POST_API_KEY yapılandırılmamış.";
  if (status === "profile_required") return "Upload-Post profil adı eksik.";
  if (status === "unsupported") return "Bu platform için Upload-Post analytics desteği yok.";
  return null;
}

function toAnalyticsAccount(row: DatabaseAccount, configured: boolean, previous?: SocialAnalyticsAccount): SocialAnalyticsAccount {
  const platform = normalizePlatform(row["Social Media"] ?? "");
  const profileUsername = row["upload-post profile username"]?.trim() || null;
  const samePlatform = previous?.platform === platform;
  const status = accountStatus(platform, profileUsername ?? "", configured);
  return {
    id: row.id,
    platform,
    accountName: row["Account Name"]?.trim() || "Adsız hesap",
    profileUsername,
    profileHandle: samePlatform ? previous?.profileHandle ?? null : null,
    description: row.description,
    status,
    statusMessage: statusMessage(status),
    directConnectionStatus: samePlatform ? previous?.directConnectionStatus ?? null : null,
    directConnectionProvider: samePlatform ? previous?.directConnectionProvider ?? null : null,
    directConnectionLastValidatedAt: samePlatform ? previous?.directConnectionLastValidatedAt ?? null : null,
    directConnectionError: samePlatform ? previous?.directConnectionError ?? null : null,
    metrics: samePlatform ? previous?.metrics ?? null : null,
    recentPosts: samePlatform ? previous?.recentPosts ?? [] : [],
  };
}

function toDatabasePayload(draft: AccountDraft) {
  return {
    socialMedia: draft.socialMedia,
    accountName: draft.accountName,
    uploadPostProfileUsername: draft.uploadPostProfileUsername,
    description: draft.description.trim() || null,
  };
}

async function requestAccount(path: string, init?: RequestInit) {
  const response = await fetch(`/api/developer/social-analytics/accounts${path}`, { ...init, cache: "no-store" });
  const payload = await response.json().catch(() => null) as { account?: DatabaseAccount; deletedId?: number; errorCode?: string } | null;
  if (!response.ok) throw new Error(payload?.errorCode ?? "social_media_update_failed");
  return payload;
}

function errorMessage(errorCode: string) {
  const messages: Record<string, string> = {
    invalid_social_media: "Platform, hesap adı ve Upload-Post profil adı zorunlu.",
    social_media_not_found: "Hesap artık mevcut değil. Verileri yenileyin.",
    social_media_in_use: "Bu hesap yayın kayıtlarına bağlı olduğu için silinemiyor.",
    social_media_create_failed: "Sosyal medya hesabı oluşturulamadı.",
    social_media_update_failed: "Sosyal medya hesabı kaydedilemedi.",
    social_media_delete_failed: "Sosyal medya hesabı silinemedi.",
  };
  return messages[errorCode] ?? "Sosyal medya hesabı işlemi tamamlanamadı.";
}

function PlatformMark({ platform }: { platform: string }) {
  const theme = getSocialPlatformTheme(platform);
  return <span aria-label={theme.label} className="grid size-11 shrink-0 place-items-center text-white"><SocialPlatformBrandIcon platform={platform} className="size-7" /></span>;
}

function TextField({ label, value, onChange, placeholder, maxLength = 160 }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; maxLength?: number }) {
  return <label className="block text-xs font-semibold text-[#718078]"><span>{label}</span><input className="mt-1.5 h-9 w-full rounded-md border border-[#ccd7ca] bg-white px-2.5 text-sm font-normal text-[#26342b] outline-none transition-colors placeholder:text-[#a3aaa4] focus:border-[#4d8a67]" maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} /></label>;
}

export function SocialAnalyticsAccountManager({ data, platformFilter, onPlatformFilterChange, onDataChange, postStates, expandedAccounts, toggleAccountPosts, loadAccountPosts, renderPostCard }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<AccountDraft | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [saveLabel, setSaveLabel] = useState("");
  const [newPlatform, setNewPlatform] = useState<string | null>(null);
  const [newDraft, setNewDraft] = useState<AccountDraft>(EMPTY_DRAFT);
  const [newSavingPlatform, setNewSavingPlatform] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [composerAccount, setComposerAccount] = useState<SocialAnalyticsAccount | null>(null);

  useEffect(() => {
    const onPublished = (event: Event) => {
      const accountId = (event as CustomEvent<{ accountId?: number }>).detail?.accountId;
      if (typeof accountId === "number") void loadAccountPosts(accountId, null);
    };
    window.addEventListener("social-analytics:published", onPublished);
    return () => window.removeEventListener("social-analytics:published", onPublished);
  }, [loadAccountPosts]);

  const platforms = useMemo(() => {
    const unknown = [...new Set(data.accounts.map((account) => account.platform))].filter((platform) => !SUPPORTED_PLATFORMS.has(platform)).sort();
    return [...SOCIAL_ANALYTICS_PLATFORMS, ...unknown];
  }, [data.accounts]);

  const groupedAccounts = useMemo(() => {
    const groups = new Map<string, SocialAnalyticsAccount[]>();
    for (const account of data.accounts) groups.set(account.platform, [...(groups.get(account.platform) ?? []), account]);
    const keys = platformFilter === "all" ? platforms : [platformFilter];
    return keys.map((platform) => [platform, groups.get(platform) ?? []] as const);
  }, [data.accounts, platformFilter, platforms]);

  useEffect(() => {
    if (editingId === null || !draft || !draftDirty || savingId !== null) return;
    const accountId = editingId;
    const draftSnapshot = draft;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSavingId(accountId);
        setSaveLabel("Kaydediliyor…");
        setActionError("");
        try {
          const payload = await requestAccount("", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: accountId, ...toDatabasePayload(draftSnapshot) }) });
          const savedAccount = payload?.account;
          if (!savedAccount) throw new Error("social_media_update_failed");
          onDataChange((previous) => {
            const current = previous.accounts.find((account) => account.id === accountId);
            const nextAccounts = previous.accounts.map((account) => account.id === accountId ? toAnalyticsAccount(savedAccount, previous.configured, current) : account);
            return { ...previous, accounts: nextAccounts, summary: createSummary(nextAccounts, previous.summary) };
          });
          setDraftDirty(false);
          setSaveLabel("Kaydedildi");
        } catch (error) {
          setSaveLabel("Kaydedilemedi");
          setActionError(errorMessage(error instanceof Error ? error.message : "social_media_update_failed"));
        } finally {
          setSavingId(null);
        }
      })();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data.configured, draft, draftDirty, editingId, onDataChange, savingId]);

  useEffect(() => {
    if (!newPlatform || newSavingPlatform || !newDraft.accountName.trim() || !newDraft.uploadPostProfileUsername.trim()) return;
    const platform = newPlatform;
    const draftSnapshot = newDraft;
    const timer = window.setTimeout(() => {
      void (async () => {
        setNewSavingPlatform(platform);
        setNewPlatform(null);
        setActionError("");
        try {
          const payload = await requestAccount("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(toDatabasePayload({ ...draftSnapshot, socialMedia: platform })) });
          const savedAccount = payload?.account;
          if (!savedAccount) throw new Error("social_media_create_failed");
          onDataChange((previous) => {
            const nextAccounts = [...previous.accounts, toAnalyticsAccount(savedAccount, previous.configured)];
            return { ...previous, accounts: nextAccounts, summary: createSummary(nextAccounts, previous.summary) };
          });
          setNewDraft(EMPTY_DRAFT);
        } catch (error) {
          setNewPlatform(platform);
          setActionError(errorMessage(error instanceof Error ? error.message : "social_media_create_failed"));
        } finally {
          setNewSavingPlatform(null);
        }
      })();
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data.configured, newDraft, newPlatform, newSavingPlatform, onDataChange]);

  function startEditing(account: SocialAnalyticsAccount) {
    setActionError("");
    setEditingId(account.id);
    setDraft({ socialMedia: account.platform, accountName: account.accountName, uploadPostProfileUsername: account.profileUsername ?? "", description: account.description ?? "" });
    setDraftDirty(false);
    setSaveLabel("");
  }

  function updateDraft(update: Partial<AccountDraft>) {
    setDraft((current) => current ? { ...current, ...update } : current);
    setDraftDirty(true);
    setSaveLabel("Değişiklik bekliyor");
  }

  function startNewAccount(platform: string) {
    setActionError("");
    setNewPlatform((current) => current === platform ? null : platform);
    setNewDraft({ ...EMPTY_DRAFT, socialMedia: platform });
  }

  async function deleteAccount(account: SocialAnalyticsAccount) {
    if (!window.confirm(`${account.accountName} hesabı silinsin mi? Bu işlem geri alınamaz.`)) return;
    setActionError("");
    try {
      const payload = await requestAccount(`?id=${encodeURIComponent(account.id)}`, { method: "DELETE" });
      if (payload?.deletedId !== account.id) throw new Error("social_media_delete_failed");
      onDataChange((previous) => {
        const nextAccounts = previous.accounts.filter((item) => item.id !== account.id);
        return { ...previous, accounts: nextAccounts, summary: createSummary(nextAccounts, previous.summary) };
      });
      if (editingId === account.id) {
        setEditingId(null);
        setDraft(null);
      }
    } catch (error) {
      setActionError(errorMessage(error instanceof Error ? error.message : "social_media_delete_failed"));
    }
  }

  return <><section className="mt-4 rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 className="text-base font-semibold text-[#26342b]">Sosyal medya hesapları</h2><p className="mt-1 text-xs leading-5 text-[#7b867e]">Hesapları burada yönetin; değişiklikler kısa bir beklemeden sonra otomatik olarak Supabase&apos;e kaydedilir.</p></div><div className="flex flex-wrap gap-2"><button className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${platformFilter === "all" ? "bg-[#26342b] text-white" : "bg-[#f1f3ee] text-[#66746a] hover:bg-[#e7ebe3]"}`} onClick={() => onPlatformFilterChange("all")} type="button">Tümü</button>{platforms.map((platform) => <button className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${platformFilter === platform ? "bg-[#26342b] text-white" : "bg-[#f1f3ee] text-[#66746a] hover:bg-[#e7ebe3]"}`} key={platform} onClick={() => onPlatformFilterChange(platform)} type="button">{platformLabel(platform)}</button>)}</div></div>{actionError ? <div className="mt-4 rounded-lg border border-[#edc7bc] bg-[#fff1ed] px-3 py-2.5 text-xs text-[#8b3b2b]" role="alert">{actionError}</div> : null}<div className="mt-5 space-y-5">{groupedAccounts.map(([platform, accounts]) => { const theme = getSocialPlatformTheme(platform); const isNewOpen = newPlatform === platform; return <section className="overflow-hidden rounded-xl border" key={platform} style={{ backgroundColor: theme.accent, borderColor: theme.accent }}><div className="flex flex-col gap-3 border-b px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between" style={{ backgroundColor: theme.accent, borderBottomColor: "rgba(255,255,255,0.28)" }}><div className="flex items-center gap-3"><PlatformMark platform={platform} /><div><h3 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">{platformLabel(platform)}</h3><p className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.78)" }}>{accounts.length} hesap · {formatNumber(sumMetric(accounts, (metrics) => metrics.followers))} takipçi · {formatNumber(sumMetric(accounts, (metrics) => metrics.engagement))} etkileşim</p></div></div><div className="flex flex-wrap items-center gap-2"><span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#68766c]"><span className="size-1.5 rounded-full bg-[#4d9a67]" />{accounts.filter((account) => account.status === "live").length} canlı</span><button className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/25" onClick={() => startNewAccount(platform)} type="button">{isNewOpen ? <X className="size-3.5" /> : <Plus className="size-3.5" />}{isNewOpen ? "Formu kapat" : "Yeni hesap ekle"}</button></div></div><div className="space-y-3 p-3">{isNewOpen ? <div className="rounded-lg border border-dashed border-white/60 bg-white/95 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[#26342b]">Yeni {platformLabel(platform)} hesabı</p><p className="mt-1 text-xs text-[#718078]">Zorunlu alanlar tamamlanınca otomatik kaydedilir.</p></div>{newSavingPlatform === platform ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4d8a67]"><LoaderCircle className="size-3.5 animate-spin" />Kaydediliyor</span> : null}</div><div className="mt-4 grid gap-3 md:grid-cols-3"><TextField label="Hesap adı" onChange={(value) => setNewDraft((current) => ({ ...current, accountName: value }))} placeholder="FoxiesDeck Türkiye" value={newDraft.accountName} /><TextField label="Upload-Post profil adı" onChange={(value) => setNewDraft((current) => ({ ...current, uploadPostProfileUsername: value }))} placeholder="upload-post profil adı" value={newDraft.uploadPostProfileUsername} /><TextField label="Açıklama (opsiyonel)" maxLength={2_000} onChange={(value) => setNewDraft((current) => ({ ...current, description: value }))} placeholder="İç not" value={newDraft.description} /></div></div> : null}{accounts.map((account) => { const profileUrl = getSocialProfileUrl(account.platform, account.profileHandle); const postState = postStates[account.id]; const expanded = expandedAccounts[account.id] === true; const editing = editingId === account.id && draft; return <article className="rounded-lg border bg-[#fcfbf8]" key={account.id} style={{ borderColor: theme.border, borderTopColor: theme.accent, borderTopWidth: "3px" }}><div className="p-4">{editing ? <div className="rounded-lg border border-[#d9e4d7] bg-[#f7faf5] p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[#26342b]">Hesabı düzenle</p><p className="mt-1 text-xs text-[#718078]">Alan değişiklikleri otomatik kaydedilir.</p></div><div className="flex items-center gap-2"><span className="text-xs font-semibold text-[#718078]">{savingId === account.id ? "Kaydediliyor…" : saveLabel}</span><button aria-label="Düzenlemeyi kapat" className="rounded-md p-1.5 text-[#718078] hover:bg-[#e8eee5]" onClick={() => { setEditingId(null); setDraft(null); setDraftDirty(false); }} type="button"><X className="size-4" /></button></div></div><div className="mt-3 grid gap-3 md:grid-cols-4"><TextField label="Platform" onChange={(value) => updateDraft({ socialMedia: value })} placeholder="instagram" value={draft.socialMedia} /><TextField label="Hesap adı" onChange={(value) => updateDraft({ accountName: value })} placeholder="FoxiesDeck Türkiye" value={draft.accountName} /><TextField label="Upload-Post profil adı" onChange={(value) => updateDraft({ uploadPostProfileUsername: value })} placeholder="upload-post profil adı" value={draft.uploadPostProfileUsername} /><TextField label="Açıklama" maxLength={2_000} onChange={(value) => updateDraft({ description: value })} placeholder="İç not" value={draft.description} /></div></div> : <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-lg font-semibold leading-6 text-[#26342b]">{account.accountName}</h4>{profileUrl ? <a aria-label={`${account.accountName} ${platformLabel(platform)} profile link`} className="inline-flex shrink-0 p-1 transition-opacity hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#26342b]/40" href={profileUrl} onClick={(event) => event.stopPropagation()} rel="noreferrer" style={{ color: theme.accent }} target="_blank" title="Open social media profile"><ExternalLink className="size-4" aria-hidden="true" /></a> : null}<span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses(account.status)}`}><span className="size-1.5 rounded-full bg-current" />{statusLabel(account)}</span></div><p className="mt-1 truncate text-xs text-[#89938b]">{account.profileUsername ? `@${account.profileUsername}` : "Upload-Post profil adı yok"}{account.description ? ` · ${account.description}` : ""}</p>{account.statusMessage ? <p className="mt-2 text-xs leading-5 text-[#9b5b14]">{account.statusMessage}</p> : null}</div><div className="flex shrink-0 flex-col items-end gap-2 text-xs text-[#718078]"><span>{account.directConnectionStatus ? <><span className="font-medium">{account.directConnectionProvider ?? "OAuth"}:</span> {account.directConnectionStatus}</> : "Supabase bağlantı kaydı yok"}</span><div className="flex items-center gap-2"><button className="inline-flex items-center gap-1.5 rounded-md border border-[#2f7251] bg-[#2f7251] px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-95" onClick={() => setComposerAccount(account)} type="button"><Send className="size-3.5" />Post at</button><button className="inline-flex items-center gap-1.5 rounded-md border border-[#ccd7ca] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#405548] hover:bg-[#f1f5ef]" onClick={() => startEditing(account)} type="button"><Edit3 className="size-3.5" />Düzenle</button><button aria-label={`${account.accountName} hesabını sil`} className="inline-flex items-center gap-1.5 rounded-md border border-[#edc7bc] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#8b3b2b] hover:bg-[#fff1ed]" onClick={() => void deleteAccount(account)} type="button"><Trash2 className="size-3.5" />Sil</button></div></div></div>}<div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8"><div className="rounded-md p-2.5" style={{ backgroundColor: theme.accent }}><p className="text-[11px] text-white/80">Takipçi</p><p className="mt-1 text-sm font-semibold tabular-nums text-white">{formatNumber(account.metrics?.followers)}</p></div><div className="rounded-md p-2.5" style={{ backgroundColor: theme.accent }}><p className="text-[11px] text-white/80">Takip edilen</p><p className="mt-1 text-sm font-semibold tabular-nums text-white">{formatNumber(account.metrics?.following)}</p></div><div className="rounded-md p-2.5" style={{ backgroundColor: theme.accent }}><p className="text-[11px] text-white/80">Gönderi</p><p className="mt-1 text-sm font-semibold tabular-nums text-white">{formatNumber(account.metrics?.postsCount)}</p></div><div className="rounded-md bg-[#f2f4ef] p-2.5"><p className="text-[11px] text-[#89938b]">Erişim</p><p className="mt-1 text-sm font-semibold tabular-nums text-[#405548]">{formatNumber(account.metrics?.reach)}</p></div><div className="rounded-md bg-[#f2f4ef] p-2.5"><p className="text-[11px] text-[#89938b]">Görüntülenme</p><p className="mt-1 text-sm font-semibold tabular-nums text-[#405548]">{formatNumber(account.metrics?.views ?? account.metrics?.impressions)}</p></div><div className="rounded-md bg-[#f2f4ef] p-2.5"><p className="text-[11px] text-[#89938b]">Beğeni</p><p className="mt-1 text-sm font-semibold tabular-nums text-[#405548]">{formatNumber(account.metrics?.likes)}</p></div><div className="rounded-md bg-[#f2f4ef] p-2.5"><p className="text-[11px] text-[#89938b]">Yorum</p><p className="mt-1 text-sm font-semibold tabular-nums text-[#405548]">{formatNumber(account.metrics?.comments)}</p></div><div className="rounded-md bg-[#f2f4ef] p-2.5"><p className="text-[11px] text-[#89938b]">Paylaşım</p><p className="mt-1 text-sm font-semibold tabular-nums text-[#405548]">{formatNumber(account.metrics?.shares)}</p></div></div><button aria-expanded={expanded} className="mt-4 inline-flex w-full items-center justify-between rounded-lg border border-[#ccd7ca] bg-white px-3 py-2.5 text-sm font-semibold text-[#405548] transition-colors hover:bg-[#f1f5ef] disabled:cursor-wait disabled:opacity-70" disabled={account.status !== "live"} onClick={() => toggleAccountPosts(account.id)} type="button"><span className="inline-flex items-center gap-2"><CalendarDays className="size-4" />Gönderiler{postState?.loaded ? ` (${postState.posts.length}${postState.hasMore ? "+" : ""})` : "i"}</span>{postState?.loading ? <LoaderCircle className="size-4 animate-spin" /> : expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</button></div>{expanded ? <div className="border-t border-[#e1e5dd] bg-[#f8f9f5] p-3"><div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-[#405548]">Gönderi performansı</p><p className="mt-1 text-xs text-[#89938b]">Görsel, açıklama ve platform istatistikleri.</p></div><span className="text-[11px] text-[#89938b]">Sayfalı yükleme</span></div>{postState?.error ? <div className="rounded-md border border-[#edc7bc] bg-[#fff1ed] p-3 text-xs text-[#8b3b2b]">{postState.error}</div> : null}{postState?.loading && !postState.posts.length ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#7b867e]"><LoaderCircle className="size-4 animate-spin" />Gönderiler yükleniyor…</div> : null}{postState?.loaded && !postState.posts.length && !postState.error ? <p className="py-8 text-center text-sm text-[#89938b]">Bu hesapta gösterilecek gönderi bulunamadı.</p> : null}<div className="grid gap-3 lg:grid-cols-2">{postState?.posts.map((post) => <span key={`${post.platform}:${post.id}`}>{renderPostCard(post)}</span>)}</div>{postState?.hasMore ? <button className="mx-auto mt-4 inline-flex items-center gap-2 rounded-lg border border-[#ccd7ca] bg-white px-3 py-2 text-xs font-semibold text-[#405548] hover:bg-[#f1f5ef]" disabled={postState.loading} onClick={() => void loadAccountPosts(account.id, postState.nextCursor)} type="button">{postState.loading ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Daha fazla gönderi yükle</button> : null}</div> : null}</article>; })}{!accounts.length && !isNewOpen ? <div className="rounded-lg border border-dashed border-white/50 bg-white/10 px-4 py-8 text-center text-sm text-white/85">Bu platform için henüz sosyal medya hesabı eklenmedi.</div> : null}{newSavingPlatform === platform ? <div className="flex items-center justify-center gap-2 rounded-lg bg-white/15 px-4 py-4 text-sm text-white"><LoaderCircle className="size-4 animate-spin" />Yeni hesap kaydediliyor…</div> : null}</div></section>; })}</div></section>{composerAccount ? <SocialPostComposerOverlay account={composerAccount} onClose={() => setComposerAccount(null)} /> : null}</>;
}
