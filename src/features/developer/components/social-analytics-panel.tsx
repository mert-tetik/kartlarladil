"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Eye,
  Globe2,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  RefreshCw,
  Send,
  Share2,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type {
  SocialAnalyticsAccount,
  SocialAnalyticsData,
  SocialAnalyticsPost,
  SocialAnalyticsPostStats,
  SocialAnalyticsSeriesPoint,
} from "@/features/developer/social-analytics-types";
import { getSocialPlatformTheme, SocialPlatformBrandIcon } from "@/features/developer/components/social-platform-brand";
import { SocialAnalyticsAccountManager } from "@/features/developer/components/social-analytics-account-manager";

const numberFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });
const tooltipDateFormatter = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const periodOptions = [7, 30, 90] as const;

type PostState = {
  posts: SocialAnalyticsPost[];
  nextCursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
  error: string;
};

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : numberFormatter.format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
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

function PlatformMark({ platform, inverse = false }: { platform: string; inverse?: boolean }) {
  const theme = getSocialPlatformTheme(platform);
  return <span aria-label={theme.label} className="grid size-14 shrink-0 place-items-center" style={{ color: inverse ? "#ffffff" : theme.accent }}><SocialPlatformBrandIcon platform={platform} className="size-9" /></span>;
}

function MetricCard({ label, value, detail, icon: Icon, tone = "green" }: { label: string; value: string; detail: string; icon: typeof Users; tone?: "green" | "blue" | "amber" | "violet" }) {
  const tones = {
    green: "bg-[#55c56a]",
    blue: "bg-[#3d9fe0]",
    amber: "bg-[#f5a623]",
    violet: "bg-[#9367d8]",
  };
  return <article className={`rounded-xl p-4 ${tones[tone]}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-white">{label}</p><span className="grid size-8 shrink-0 place-items-center text-white"><Icon className="size-5" aria-hidden="true" /></span></div><p className="mt-3 text-2xl font-semibold tabular-nums text-white">{value}</p><p className="mt-1 text-xs text-white/80">{detail}</p></article>;
}

function ExposureChart({ series }: { series: SocialAnalyticsSeriesPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (!series.length) return <div className="grid min-h-48 place-items-center rounded-lg bg-[#f4f5f0] text-sm text-[#89938b]">Henüz zaman serisi verisi yok.</div>;
  const width = 720;
  const height = 220;
  const padding = { top: 16, right: 14, bottom: 30, left: 14 };
  const max = Math.max(1, ...series.map((point) => point.value));
  const points = series.map((point, index) => ({
    ...point,
    x: padding.left + (index / Math.max(1, series.length - 1)) * (width - padding.left - padding.right),
    y: height - padding.bottom - (point.value / max) * (height - padding.top - padding.bottom),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const step = Math.max(1, Math.ceil(series.length / 6));
  return <div><svg className="h-56 w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Toplam erişim ve görüntülenme grafiği">{[0, 1, 2, 3].map((index) => { const y = padding.top + (index / 3) * (height - padding.top - padding.bottom); return <line key={index} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e6e9e2" strokeWidth="1" />; })}<polyline fill="none" points={line} stroke="#2f7251" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />{points.map((point, index) => { const active = activeIndex === index; const tooltipWidth = 132; const tooltipX = Math.min(Math.max(point.x - tooltipWidth / 2, padding.left), width - padding.right - tooltipWidth); const tooltipY = Math.max(4, point.y - 58); const dateValue = point.date.includes("T") ? point.date : point.date + "T00:00:00Z"; const dateLabel = tooltipDateFormatter.format(new Date(dateValue)); return <g key={point.date} tabIndex={0} aria-label={dateLabel + ": " + formatNumber(point.value)} onBlur={() => setActiveIndex(null)} onFocus={() => setActiveIndex(index)} onMouseEnter={() => setActiveIndex(index)} onMouseLeave={() => setActiveIndex(null)}><circle cx={point.x} cy={point.y} fill="#fcfbf8" r="3.5" stroke="#2f7251" strokeWidth="2" /><title>{dateLabel + " — " + formatNumber(point.value)}</title>{active ? <g pointerEvents="none"><rect fill="#26342b" height="44" rx="6" width={tooltipWidth} x={tooltipX} y={tooltipY} /><text fill="#b9c9bc" fontSize="10" textAnchor="middle" x={tooltipX + tooltipWidth / 2} y={tooltipY + 13}>{dateLabel}</text><text fill="#ffffff" fontSize="12" fontWeight="600" textAnchor="middle" x={tooltipX + tooltipWidth / 2} y={tooltipY + 31}>{formatNumber(point.value)} toplam</text></g> : null}</g>; })}{points.map((point, index) => index % step === 0 || index === points.length - 1 ? <text fill="#89938b" fontSize="10" key={`label-${point.date}`} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} x={point.x} y={height - 7}>{shortDateFormatter.format(new Date(point.date))}</text> : null)}</svg><div className="mt-1 flex items-center gap-2 text-xs text-[#7b867e]"><span className="size-2 rounded-full bg-[#2f7251]" /> Günlük toplam erişim / görüntülenme</div></div>;
}

function FollowersChart({ accounts, totalFollowers }: { accounts: SocialAnalyticsAccount[]; totalFollowers: number }) {
  const byPlatform = new Map<string, number>();
  for (const account of accounts) {
    const followers = account.metrics?.followers;
    if (followers !== null && followers !== undefined) byPlatform.set(account.platform, (byPlatform.get(account.platform) ?? 0) + followers);
  }
  const rows = [...byPlatform.entries()]
    .map(([platform, value]) => ({ platform, value }))
    .sort((first, second) => second.value - first.value);
  const max = Math.max(1, ...rows.map((row) => row.value));

  return <div className="min-h-48">
    <div className="flex items-end justify-between gap-3">
      <div><p className="text-xs font-medium text-[#718078]">Toplam takipçi</p><p className="mt-1 text-3xl font-semibold tabular-nums text-[#26342b]">{formatNumber(totalFollowers)}</p></div>
      <Users className="size-6 text-[#4d8a67]" aria-hidden="true" />
    </div>
    {rows.length ? <div className="mt-6 space-y-3">{rows.map((row) => { const theme = getSocialPlatformTheme(row.platform); return <div key={row.platform}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-[#526158]">{platformLabel(row.platform)}</span><span className="tabular-nums text-[#718078]">{formatNumber(row.value)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[#e9ede6]"><div className="h-full rounded-full transition-all" style={{ width: `${Math.max(3, (row.value / max) * 100)}%`, backgroundColor: theme.accent }} /></div></div>; })}</div> : <div className="mt-8 grid place-items-center rounded-lg bg-[#f4f5f0] py-8 text-sm text-[#89938b]">Henüz takipçi verisi yok.</div>}
  </div>;
}

function PostStat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number | null | undefined }) {
  if (value === null || value === undefined) return null;
  return <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f2f4ef] px-2 py-1 text-[11px] font-medium text-[#657168]" title={label}><Icon className="size-3.5" aria-hidden="true" />{formatNumber(value)}</span>;
}

function isVideoPost(post: SocialAnalyticsPost) {
  const mediaType = post.mediaType?.toLocaleLowerCase() ?? "";
  return mediaType.includes("video") || mediaType.includes("reel") || mediaType.includes("short") || /\.(?:mp4|mov|webm)(?:[?#].*)?$/iu.test(post.mediaUrl ?? "");
}

function PostMedia({ post, variant }: { post: SocialAnalyticsPost; variant: "thumbnail" | "overlay" }) {
  if (!post.mediaUrl) return <ImageIcon className={variant === "overlay" ? "size-12 text-[#647168]" : "size-5"} aria-hidden="true" />;
  if (isVideoPost(post)) {
    return <video aria-label="Gönderi videosu" className={variant === "overlay" ? "max-h-[calc(100dvh-4rem)] max-w-full rounded-lg object-contain" : "size-full object-cover"} controls={variant === "overlay"} muted={variant === "thumbnail"} playsInline preload="metadata" src={post.mediaUrl} />;
  }
  // Native img keeps provider-hosted media working without a fixed Next Image domain allowlist.
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="Gönderi görseli" className={variant === "overlay" ? "max-h-[calc(100dvh-4rem)] max-w-full rounded-lg object-contain" : "size-full object-cover"} loading={variant === "thumbnail" ? "lazy" : undefined} src={post.mediaUrl} />;
}

function PostOverlay({ post, onClose }: { post: SocialAnalyticsPost; onClose: () => void }) {
  const theme = getSocialPlatformTheme(post.platform);
  const stats = post.stats;

  return createPortal(
    <div aria-label="Gönderi detayı" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#101412]/85 p-3 backdrop-blur-sm sm:p-6" onClick={onClose} role="dialog">
      <div className="relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl isolate overflow-auto rounded-xl border bg-[#fcfbf8]" onClick={(event) => event.stopPropagation()} style={{ borderColor: theme.border }}>
        <button aria-label="Gönderi detayını kapat" className="absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-lg bg-[#101412]/75 text-white transition-colors hover:bg-[#101412]" onClick={onClose} type="button">
          <X className="size-5" />
        </button>
        <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
          <div className="flex min-h-[22rem] items-center justify-center bg-[#080a09] p-4 sm:min-h-[34rem]">
            <PostMedia post={post} variant="overlay" />
          </div>
          <div className="p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <PlatformMark platform={post.platform} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.accent }}>{theme.label}</p>
                <p className="mt-1 text-xs text-[#89938b]">{post.mediaType ?? "Gönderi"} · {formatDate(post.timestamp)}</p>
              </div>
            </div>
            <h2 className="mt-6 text-xl font-semibold leading-7 text-[#26342b]">Gönderi detayı</h2>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[#58665c]">{post.caption || "Açıklama yok."}</p>
            <div className="mt-6 border-t border-[#e1e5dd] pt-5">
              <p className="text-xs font-semibold text-[#718078]">Gönderi istatistikleri</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <PostStat icon={Eye} label="Görüntülenme" value={stats?.views} />
                <PostStat icon={Activity} label="Erişim" value={stats?.reach} />
                <PostStat icon={BarChart3} label="Gösterim" value={stats?.impressions} />
                <PostStat icon={Heart} label="Beğeni" value={stats?.likes} />
                <PostStat icon={MessageCircle} label="Yorum" value={stats?.comments} />
                <PostStat icon={Share2} label="Paylaşım" value={stats?.shares} />
                <PostStat icon={Send} label="Kaydetme" value={stats?.saves ?? stats?.favorites} />
              </div>
              {stats === null ? <p className="mt-3 text-xs text-[#9b5b14]">Gönderi istatistiği alınamadı.</p> : stats && !Object.values(stats).some((value) => value !== null) ? <p className="mt-3 text-xs text-[#89938b]">Platform bu gönderi için istatistik döndürmedi.</p> : null}
            </div>
            {post.permalink ? <a className="mt-6 inline-flex items-center gap-2 text-sm font-semibold hover:underline" href={post.permalink} onClick={(event) => event.stopPropagation()} rel="noreferrer" style={{ color: theme.accent }} target="_blank"><ExternalLink className="size-4" />Platformda aç</a> : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PostCard({ post }: { post: SocialAnalyticsPost }) {
  const [open, setOpen] = useState(false);
  const stats: SocialAnalyticsPostStats | null = post.stats;
  const theme = getSocialPlatformTheme(post.platform);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return <><article aria-label="Gönderi detayını aç" className="cursor-pointer overflow-hidden rounded-lg border bg-white transition-colors hover:bg-[#fcfdfb]" onClick={() => setOpen(true)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setOpen(true); } }} role="button" style={{ borderColor: theme.border }} tabIndex={0}><div className="flex gap-3 p-3"><div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-md text-[#89938b] sm:size-24" style={{ backgroundColor: theme.soft }}><PostMedia post={post} variant="thumbnail" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 text-[11px] text-[#89938b]"><span className="font-semibold text-[#526158]">{post.mediaType ?? "Gönderi"}</span><span>·</span><span>{formatDate(post.timestamp)}</span></div><p className="mt-2 line-clamp-3 text-sm leading-5 text-[#445248]">{post.caption || "Açıklama yok."}</p><div className="mt-3 flex flex-wrap gap-1.5"><PostStat icon={Eye} label="Görüntülenme" value={stats?.views} /><PostStat icon={Activity} label="Erişim" value={stats?.reach} /><PostStat icon={BarChart3} label="Gösterim" value={stats?.impressions} /><PostStat icon={Heart} label="Beğeni" value={stats?.likes} /><PostStat icon={MessageCircle} label="Yorum" value={stats?.comments} /><PostStat icon={Share2} label="Paylaşım" value={stats?.shares} /><PostStat icon={Send} label="Kaydetme" value={stats?.saves ?? stats?.favorites} /></div>{post.stats && !Object.values(post.stats).some((value) => value !== null) ? <p className="mt-2 text-[11px] text-[#89938b]">Platform bu gönderi için istatistik döndürmedi.</p> : null}{post.stats === null ? <p className="mt-2 text-[11px] text-[#9b5b14]">Gönderi istatistiği alınamadı.</p> : null}</div>{post.permalink ? <a aria-label="Gönderiyi aç" className="self-start rounded-md p-1.5 text-[#718078] transition-colors hover:bg-[#f1f3ee] hover:text-[#26342b]" href={post.permalink} onClick={(event) => event.stopPropagation()} rel="noreferrer" target="_blank"><ExternalLink className="size-4" aria-hidden="true" /></a> : null}</div></article>{open ? <PostOverlay onClose={() => setOpen(false)} post={post} /> : null}</>;
}

function normalizeData(data: SocialAnalyticsData): SocialAnalyticsData {
  return {
    ...data,
    accounts: (data.accounts ?? []).map((account) => ({ ...account, recentPosts: account.recentPosts ?? [] })),
    exposureSeries: data.exposureSeries ?? [],
    summary: data.summary ?? { totalAccounts: 0, profileReadyAccounts: 0, liveAccounts: 0, errorAccounts: 0, unsupportedAccounts: 0, totalFollowers: 0, totalReach: 0, totalViews: 0, totalEngagement: 0, totalPosts: 0 },
  };
}

function postErrorMessage(errorCode: string) {
  const messages: Record<string, string> = {
    unauthorized: "Developer oturumu geçersiz.",
    upload_post_not_configured: "Upload-Post API anahtarı yapılandırılmamış.",
    upload_post_profile_not_configured: "Bu hesap için Upload-Post profil adı yok.",
    upload_post_analytics_unsupported: "Bu platformun gönderi verisi desteklenmiyor.",
    upload_post_media_unavailable: "Gönderiler Upload-Post üzerinden alınamadı.",
  };
  if (errorCode.startsWith("upload_post_http_")) return `Upload-Post gönderi isteğini reddetti (${errorCode.replace("upload_post_http_", "HTTP ")}).`;
  return messages[errorCode] ?? "Gönderiler alınamadı. Ayrıntı için sunucu loglarını kontrol edin.";
}

export function SocialAnalyticsPanel({ initialData }: { initialData: SocialAnalyticsData }) {
  const [data, setData] = useState(() => normalizeData(initialData));
  const [days, setDays] = useState<7 | 30 | 90>((initialData.days === 7 || initialData.days === 90 ? initialData.days : 30));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [expandedAccounts, setExpandedAccounts] = useState<Record<number, boolean>>({});
  const [postStates, setPostStates] = useState<Record<number, PostState>>({});

  async function refresh(nextDays = days) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/developer/social-analytics?days=${nextDays}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as SocialAnalyticsData & { errorCode?: string } | null;
      if (!response.ok || !payload) throw new Error(payload?.errorCode ?? "social_analytics_unavailable");
      setData(normalizeData(payload));
      setDays(nextDays);
      setPostStates({});
      setExpandedAccounts({});
    } catch (refreshError) {
      setError(refreshError instanceof Error ? postErrorMessage(refreshError.message) : "Sosyal analytics verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAccountPosts(accountId: number, cursor?: string | null) {
    const current = postStates[accountId];
    setPostStates((states) => ({ ...states, [accountId]: { posts: current?.posts ?? [], nextCursor: current?.nextCursor ?? null, hasMore: current?.hasMore ?? false, loading: true, loaded: current?.loaded ?? false, error: "" } }));
    try {
      const params = new URLSearchParams({ accountId: String(accountId), limit: "12" });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/developer/social-analytics/posts?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { accountId?: number; posts?: SocialAnalyticsPost[]; hasMore?: boolean; nextCursor?: string | null; errorCode?: string } | null;
      if (!response.ok || !payload) throw new Error(payload?.errorCode ?? "social_analytics_posts_unavailable");
      setPostStates((states) => {
        const previous = states[accountId];
        const posts = cursor ? [...(previous?.posts ?? []), ...(payload.posts ?? [])] : (payload.posts ?? []);
        return { ...states, [accountId]: { posts, nextCursor: payload.nextCursor ?? null, hasMore: payload.hasMore === true, loading: false, loaded: true, error: "" } };
      });
    } catch (postError) {
      setPostStates((states) => ({ ...states, [accountId]: { posts: states[accountId]?.posts ?? [], nextCursor: states[accountId]?.nextCursor ?? null, hasMore: states[accountId]?.hasMore ?? false, loading: false, loaded: states[accountId]?.loaded ?? false, error: postErrorMessage(postError instanceof Error ? postError.message : "social_analytics_posts_unavailable") } }));
    }
  }

  function toggleAccountPosts(accountId: number) {
    const expanded = expandedAccounts[accountId] === true;
    setExpandedAccounts((accounts) => ({ ...accounts, [accountId]: !expanded }));
    if (!expanded && !postStates[accountId]?.loaded && !postStates[accountId]?.loading) void loadAccountPosts(accountId);
  }

  return <main className="min-h-[calc(100dvh-4rem)] bg-[#f5f3ee] px-4 py-6 text-[#1f2922] sm:px-6 lg:px-10"><div className="mx-auto max-w-[104rem]">
    <header className="border-b border-[#d9ddd4] pb-6"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#4f6657] hover:underline" href="/developer"><ArrowLeft className="size-4" aria-hidden="true" />Developer workspace</Link><h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Social medias</h1></header>
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2"><span className="inline-flex items-center gap-2 rounded-lg border border-[#d9ddd4] bg-[#fcfbf8] px-3 py-2 text-xs font-semibold text-[#647168]"><span className={`size-2 rounded-full ${data.configured ? "bg-[#4d9a67]" : "bg-[#d19432]"}`} />{data.configured ? `Son güncelleme ${formatDate(data.fetchedAt)}` : "Upload-Post bekleniyor"}</span><button className="inline-flex items-center gap-2 rounded-lg border border-[#ccd4c9] bg-[#fcfbf8] px-3 py-2 text-sm font-semibold text-[#405548] transition-colors hover:bg-white disabled:cursor-wait disabled:opacity-60" disabled={loading} onClick={() => void refresh()} type="button"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Yenile</button></div>

    {!data.configured ? <section className="mt-6 flex items-start gap-3 rounded-xl border border-[#ecd8b9] bg-[#fff7e9] p-4 text-[#764b19]" role="alert"><TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Upload-Post bağlantısı yapılandırılmadı</p><p className="mt-1 text-sm leading-6">Server ortamına <code className="rounded bg-[#f8e9cd] px-1.5 py-0.5 text-xs">UPLOAD_POST_API_KEY</code> eklenince bu panel Supabase&apos;teki profil adları üzerinden canlı verileri getirecek.</p></div></section> : null}
    {error ? <section className="mt-4 flex items-center gap-3 rounded-xl border border-[#edc7bc] bg-[#fff1ed] p-4 text-sm text-[#8b3b2b]" role="alert"><TriangleAlert className="size-5 shrink-0" aria-hidden="true" />{error}</section> : null}

    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Sosyal medya ana metrikleri"><MetricCard label="Bağlı sosyal kayıt" value={formatNumber(data.summary.totalAccounts)} detail={`${formatNumber(data.summary.profileReadyAccounts)} Upload-Post profili hazır`} icon={Globe2} /><MetricCard label="Toplam takipçi" value={formatNumber(data.summary.totalFollowers)} detail="Platform toplamı" icon={Users} tone="blue" /><MetricCard label="Erişim" value={formatNumber(data.summary.totalReach)} detail={`${days} günlük pencere`} icon={Activity} /><MetricCard label="Görüntülenme" value={formatNumber(data.summary.totalViews)} detail={`${formatNumber(data.summary.totalPosts)} toplam içerik`} icon={Eye} tone="violet" /><MetricCard label="Etkileşim" value={formatNumber(data.summary.totalEngagement)} detail={`${formatNumber(data.summary.liveAccounts)} hesap canlı`} icon={Heart} tone="amber" /></section>

    <section className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,1fr)]"><section className="rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-base font-semibold text-[#26342b]">Erişim ve görüntülenme</h2><p className="mt-1 text-xs leading-5 text-[#7b867e]">Bağlı hesaplardan gelen günlük toplam değer.</p></div><div className="inline-flex self-start rounded-lg border border-[#d9ddd4] bg-[#f4f5f0] p-1" role="tablist" aria-label="Analytics dönemi">{periodOptions.map((option) => <button className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${days === option ? "bg-white text-[#26342b] shadow-sm" : "text-[#7b867e] hover:text-[#26342b]"}`} disabled={loading} key={option} onClick={() => void refresh(option)} role="tab" type="button" aria-selected={days === option}>{option} gün</button>)}</div></div><div className="mt-5"><ExposureChart series={data.exposureSeries} /></div></section><section className="rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><FollowersChart accounts={data.accounts} totalFollowers={data.summary.totalFollowers} /></section></section>

    <SocialAnalyticsAccountManager data={data} expandedAccounts={expandedAccounts} loadAccountPosts={loadAccountPosts} onDataChange={setData} onPlatformFilterChange={setPlatformFilter} platformFilter={platformFilter} postStates={postStates} renderPostCard={(post) => <PostCard post={post} />} toggleAccountPosts={toggleAccountPosts} />

    <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]"><section className="rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-[#26342b]">Gönderi verisi</h2><p className="mt-1 text-xs leading-5 text-[#7b867e]">Gönderi dropdown&apos;u yalnızca açılan hesabın medya listesini çağırır.</p></div><CalendarDays className="size-5 text-[#4d8a67]" /></div><div className="mt-4 space-y-3 text-sm text-[#58665c]"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#4d8a67]" /><span>Her hesap için medya kayıtları sayfalı olarak alınır; böylece panel açılışında bütün hesapların tüm gönderileri beklenmez.</span></div><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#4d8a67]" /><span>Gönderinin görseli, açıklaması, yayın tarihi, dış bağlantısı ve platformun verdiği istatistikler birlikte gösterilir.</span></div></div></section><section className="rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-[#26342b]">Veri kapsamı</h2><p className="mt-1 text-xs leading-5 text-[#7b867e]">Bu panelde kullanılan kaynaklar.</p></div><Clock3 className="size-5 text-[#5d83c5]" /></div><div className="mt-5 space-y-3 text-sm text-[#58665c]"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#4d8a67]" /><span><strong>Supabase:</strong> hesap adı, platform, Upload-Post profil adı ve bağlantı durumları.</span></div><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#4d8a67]" /><span><strong>Upload-Post:</strong> takipçi, erişim, görüntülenme, etkileşim, zaman serisi, medya ve gönderi istatistikleri.</span></div><div className="flex items-start gap-2"><MessageCircle className="mt-0.5 size-4 shrink-0 text-[#718078]" /><span>Platform desteklemediği bir metriği boş bırakır; bu durum hesap verisini geçersiz saymaz.</span></div></div></section></section>
  </div></main>;
}
