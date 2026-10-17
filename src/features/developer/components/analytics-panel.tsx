"use client";

import Link from "next/link";
import { Activity, ArrowLeft, BarChart3, CalendarClock, CheckCircle2, ChevronRight, CircleDollarSign, CreditCard, Globe2, Layers3, ListChecks, MessageSquareText, MousePointerClick, RefreshCw, ShieldCheck, Star, Users, XCircle } from "lucide-react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import type { DeveloperAnalyticsData, DeveloperAnalyticsDistributionItem, DeveloperAnalyticsSeriesPoint, DeveloperDashboardStats } from "@/features/developer/developer-types";
import { DeveloperLeaderboards } from "@/features/developer/components/developer-leaderboards";

type AnalyticsPeriod = "daily" | "weekly" | "monthly";
const numberFormatter = new Intl.NumberFormat("tr-TR");
const decimalFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 });
const tryFormatter = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const EMPTY_ANALYTICS_DATA: DeveloperAnalyticsData = {
  totalUsers: 0,
  dailyAppLogins: [],
  activity: { dau: 0, wau: 0, mau: 0, stickinessPercent: 0, dailyActiveUsers: [] },
  onboardingFunnel: [],
  appHealth: { trackedEvents: 0, errorEvents: 0, errorRatePercent: 0, lastActivityAt: null, dataSource: "no_events" },
  featureUsage: [],
  retention: { activeUsers7d: 0, activeUsers30d: 0, returningUsers30d: 0, dataSource: "last_sign_in_fallback", metrics: [], cohorts: [] },
  registrations: { daily: [], weekly: [], monthly: [] },
  nativeLanguageDistribution: [],
  learningLanguageDistribution: [],
  uiLocaleDistribution: [],
  recentLogins: [],
  cards: { addedDaily: [], addedWeekly: [], learnedDaily: [], learnedWeekly: [] },
  quiz: { totalAttempts: 0, correctAttempts: 0, incorrectAttempts: 0, accuracyPercent: 0, dailyActivity: [], averageAttemptsPerUser: 0, firstQuizUsers: 0, firstQuizRatePercent: 0, successByLanguage: [] },
  subscriptions: { byPlan: [], googlePlayCount: 0, byStatus: [], byBillingCycle: [], autoRenew: [], upcomingRenewals: [], expiringUsers: [], monthlyRevenueByPlan: [], averageRevenuePerSubscription: 0, freeToPaidTransitions: { basic: 0, pro: 0, available: false } },
  reviews: { averageRating: 0, daily: [], weekly: [], distribution: [] },
  customCards: { topProducers: [], daily: [], generationErrors: 0, generationErrorDataAvailable: false },
};

function formatNumber(value: number) { return numberFormatter.format(value); }
function formatPercent(value: number | null) { return value === null ? "—" : `%${decimalFormatter.format(value)}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(value)); }
const ANALYTICS_ACCENTS: Record<string, string> = {
  "DAU / WAU / MAU": "#00a995",
  "Retention eğrisi": "#2f7251",
  "Yeni kayıtlar": "#1687e8",
  "Günlük uygulama girişleri": "#06a6d4",
  "Kart hareketi": "#7846df",
  "Quiz aktivitesi": "#ed5b2d",
  "Abonelik dağılımı": "#3d4fd1",
  "Review aktivitesi": "#d92578",
  "Özel kart üretimi": "#f29b16",
  "Son giriş yapanlar": "#087fbe",
  "En çok özel kart üretenler": "#9a3fd1",
  "Yaklaşan yenilemeler": "#c56a00",
  "Erişimi bitecek kullanıcılar": "#e04444",
};

function analyticsAccent(title: string) { return ANALYTICS_ACCENTS[title] ?? "#2f7251"; }
function PanelBar({ accent, inset = "5", children }: { accent: string; inset?: "4" | "5"; children?: React.ReactNode }) { return <div className={`${inset === "4" ? "-mx-4 -mt-4 mb-4" : "-mx-5 -mt-5 mb-5"} ${children ? "flex min-h-11 items-center gap-2 px-4 py-2.5" : "h-2"}`} style={{ backgroundColor: accent }}>{children}</div>; }

function MetricCard({ label, value, detail, icon: Icon, palette = "emerald" }: { label: string; value: string; detail?: string; icon: typeof Users; palette?: "emerald" | "blue" | "violet" | "orange" | "teal" | "amber" | "pink" | "indigo" }) {
  const tones = {
    emerald: { card: "bg-[#11b86a]", bar: "bg-[#07874b]" },
    blue: { card: "bg-[#1687e8]", bar: "bg-[#075caf]" },
    violet: { card: "bg-[#7846df]", bar: "bg-[#4d25ac]" },
    orange: { card: "bg-[#ed5b2d]", bar: "bg-[#b93412]" },
    teal: { card: "bg-[#00a995]", bar: "bg-[#007967]" },
    amber: { card: "bg-[#f29b16]", bar: "bg-[#b96800]" },
    pink: { card: "bg-[#d92578]", bar: "bg-[#9f124f]" },
    indigo: { card: "bg-[#3d4fd1]", bar: "bg-[#26349b]" },
  };
  const colors = tones[palette];
  return <article className={`overflow-hidden rounded-xl border border-transparent ${colors.card}`}><div className={`flex items-center justify-between gap-3 px-4 py-2.5 ${colors.bar}`}><p className="text-xs font-semibold text-white">{label}</p><Icon className="size-5 text-white" aria-hidden="true" /></div><div className="p-4"><p className="text-2xl font-semibold tabular-nums text-white">{value}</p>{detail ? <p className="mt-1 text-xs text-white">{detail}</p> : null}</div></article>;
}

function RetentionKpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-lg bg-[#f1f4ee] px-3.5 py-3"><p className="text-xs font-semibold text-[#718078]">{label}</p><p className="mt-1.5 text-xl font-semibold tabular-nums text-[#26342b]">{value}</p><p className="mt-1 text-[11px] leading-4 text-[#89938b]">{detail}</p></div>;
}

function ChartCard({ title, description, children, period, onPeriodChange }: { title: string; description?: string; children: React.ReactNode; period?: AnalyticsPeriod; onPeriodChange?: (period: AnalyticsPeriod) => void }) {
  return <section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5" style={{ "--analytics-accent": analyticsAccent(title) } as CSSProperties}><PanelBar accent={analyticsAccent(title)}><h2 className="text-sm font-semibold text-white">{title}</h2></PanelBar><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div>{description ? <p className="text-xs leading-5 text-[#7b867e]">{description}</p> : null}</div>{period && onPeriodChange ? <div className="inline-flex self-start rounded-lg border border-[#d9ddd4] bg-[#f4f5f0] p-1" role="tablist" aria-label={`${title} dönemi`}>{(["daily", "weekly", "monthly"] as const).map((option) => <button className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${period === option ? "bg-white text-[#26342b] shadow-sm" : "text-[#7b867e] hover:text-[#26342b]"}`} key={option} onClick={() => onPeriodChange(option)} role="tab" type="button" aria-selected={period === option}>{option === "daily" ? "Gün" : option === "weekly" ? "Hafta" : "Ay"}</button>)}</div> : null}</div><div className="mt-5">{children}</div></section>;
}

function LineChart({ series = [], secondaryLabel, valueLabel = "Değer" }: { series?: DeveloperAnalyticsSeriesPoint[]; secondaryLabel?: string; valueLabel?: string }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(series.at(-1)?.key ?? null);
  const [selectedSeries, setSelectedSeries] = useState<"primary" | "secondary">("primary");
  const width = 640;
  const height = 190;
  const padding = { top: 12, right: 12, bottom: 25, left: 12 };
  const max = Math.max(1, ...series.map((point) => Math.max(point.value, point.secondaryValue ?? 0)));
  const points = series.map((point, index) => {
    const x = padding.left + (index / Math.max(1, series.length - 1)) * (width - padding.left - padding.right);
    const y = height - padding.bottom - (point.value / max) * (height - padding.top - padding.bottom);
    const secondaryY = height - padding.bottom - ((point.secondaryValue ?? 0) / max) * (height - padding.top - padding.bottom);
    return { ...point, x, y, secondaryY };
  });
  const selected = series.find((point) => point.key === selectedKey) ?? series.at(-1) ?? null;
  const activeSelectedKey = selected?.key;
  const primaryColor = "var(--analytics-accent, #2f7251)";
  const selectedPointColor = selectedSeries === "secondary" && secondaryLabel ? "#5d83c5" : primaryColor;
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const secondaryLine = points.map((point) => `${point.x},${point.secondaryY}`).join(" ");
  const step = Math.max(1, Math.ceil(series.length / 6));
  const selectPoint = (key: string, chartSeries: "primary" | "secondary" = "primary") => {
    setSelectedKey(key);
    setSelectedSeries(chartSeries);
  };

  return <div>
    <div className="overflow-x-auto">
      <svg className="h-48 min-w-[34rem] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Zaman serisi grafiği">
        {[0, 1, 2, 3].map((lineIndex) => {
          const y = padding.top + (lineIndex / 3) * (height - padding.top - padding.bottom);
          return <line key={lineIndex} x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e6e9e2" strokeWidth="1" />;
        })}
        <polyline fill="none" points={line} stroke={primaryColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {secondaryLabel ? <polyline fill="none" points={secondaryLine} stroke="#5d83c5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" /> : null}
        {points.map((point) => <g key={point.key}>
          {secondaryLabel ? <>
            <circle
              aria-label={`${point.label}: ${secondaryLabel} ${formatNumber(point.secondaryValue ?? 0)}`}
              className="cursor-pointer outline-none focus-visible:stroke-[#1d4d35]"
              cx={point.x}
              cy={point.secondaryY}
              fill="transparent"
              onClick={() => selectPoint(point.key, "secondary")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectPoint(point.key);
                }
              }}
              r="10"
              role="button"
              tabIndex={0}
            />
            <circle cx={point.x} cy={point.secondaryY} fill={activeSelectedKey === point.key && selectedSeries === "secondary" ? "#5d83c5" : "#fcfbf8"} pointerEvents="none" r={activeSelectedKey === point.key && selectedSeries === "secondary" ? "5" : "3.5"} stroke="#5d83c5" strokeWidth="2" />
          </> : null}
          <circle
            aria-label={`${point.label}: ${valueLabel} ${formatNumber(point.value)}${secondaryLabel ? `, ${secondaryLabel} ${formatNumber(point.secondaryValue ?? 0)}` : ""}`}
            className="cursor-pointer outline-none focus-visible:stroke-[#1d4d35]"
            cx={point.x}
            cy={point.y}
            fill="transparent"
            onClick={() => selectPoint(point.key, "primary")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectPoint(point.key);
              }
            }}
            r="10"
            role="button"
            tabIndex={0}
          />
          <circle cx={point.x} cy={point.y} fill={activeSelectedKey === point.key && selectedSeries === "primary" ? primaryColor : "#fcfbf8"} pointerEvents="none" r={activeSelectedKey === point.key && selectedSeries === "primary" ? "5" : "3.5"} stroke={primaryColor} strokeWidth="2" />
        </g>)}
        {series.map((point, index) => index % step === 0 || index === series.length - 1 ? <text fill="#89938b" fontSize="10" key={`label-${point.key}`} textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"} x={points[index].x} y={height - 5}>{point.label}</text> : null)}
      </svg>
    </div>
    {selected ? <div className="mt-3 rounded-lg border border-transparent px-3 py-2.5 text-xs text-white" role="status" style={{ backgroundColor: selectedPointColor }}>
      <p className="font-semibold text-white">Seçili nokta</p>
      <div className="mt-1.5 grid gap-1 text-white sm:grid-cols-3">
        <span><span className="font-medium text-white">Tarih / dönem:</span> {selected.key} · {selected.label}</span>
        <span><span className="font-medium text-white">{valueLabel}:</span> {formatNumber(selected.value)}</span>
        {secondaryLabel ? <span><span className="font-medium text-white">{secondaryLabel}:</span> {formatNumber(selected.secondaryValue ?? 0)}</span> : null}
      </div>
    </div> : <p className="mt-3 text-xs text-[#89938b]">Henüz grafik verisi yok.</p>}
    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#7b867e]"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: primaryColor }} /> {valueLabel}</span>{secondaryLabel ? <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#5d83c5]" /> {secondaryLabel}</span> : null}</div>
  </div>;
}

function DistributionList({ items, valueSuffix, emptyText = "Henüz veri yok" }: { items: DeveloperAnalyticsDistributionItem[]; valueSuffix?: string; emptyText?: string }) {
  if (items.length === 0) return <p className="text-sm text-[#89938b]">{emptyText}</p>;
  const maxPercent = Math.max(1, ...items.map((item) => item.percent));
  return <div className="space-y-3">{items.slice(0, 8).map((item) => <div key={item.key}><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-medium text-[#445247]">{item.label}</span><span className="shrink-0 tabular-nums text-[#7b867e]">{formatNumber(item.value)}{valueSuffix ? ` ${valueSuffix}` : ""} · %{item.percent}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#edf0ea]"><div className="h-full rounded-full bg-[#4d8a65] transition-[width]" style={{ width: `${Math.max(2, (item.percent / maxPercent) * 100)}%` }} /></div></div>)}</div>;
}

function LegendStat({ label, value, color }: { label: string; value: string; color: string }) { return <div className="flex items-center justify-between gap-3 text-sm"><span className="inline-flex items-center gap-2 text-[#66746a]"><span className={`size-2.5 rounded-full ${color}`} />{label}</span><strong className="tabular-nums text-[#26342b]">{value}</strong></div>; }
function EmptyTable({ text }: { text: string }) { return <p className="py-8 text-center text-sm text-[#89938b]">{text}</p>; }
function statusLabel(value: string) { const labels: Record<string, string> = { active: "Aktif", passive: "Pasif", cancelled: "İptal", free: "Free" }; return labels[value] ?? value; }

export function AnalyticsPanel({ initialStats, analytics: suppliedAnalytics }: { initialStats: DeveloperDashboardStats; analytics?: DeveloperAnalyticsData }) {
  const source = suppliedAnalytics ?? EMPTY_ANALYTICS_DATA;
  const analytics: DeveloperAnalyticsData = {
    ...EMPTY_ANALYTICS_DATA,
    ...source,
    dailyAppLogins: source.dailyAppLogins ?? [],
    activity: {
      ...EMPTY_ANALYTICS_DATA.activity,
      ...source.activity,
      dailyActiveUsers: source.activity?.dailyActiveUsers ?? [],
    },
    onboardingFunnel: source.onboardingFunnel ?? [],
    appHealth: { ...EMPTY_ANALYTICS_DATA.appHealth, ...source.appHealth },
    featureUsage: source.featureUsage ?? [],
    retention: {
      ...EMPTY_ANALYTICS_DATA.retention,
      ...source.retention,
      metrics: source.retention?.metrics ?? [],
      cohorts: source.retention?.cohorts ?? [],
    },
    registrations: {
      daily: source.registrations?.daily ?? [],
      weekly: source.registrations?.weekly ?? [],
      monthly: source.registrations?.monthly ?? [],
    },
    nativeLanguageDistribution: source.nativeLanguageDistribution ?? [],
    learningLanguageDistribution: source.learningLanguageDistribution ?? [],
    uiLocaleDistribution: source.uiLocaleDistribution ?? [],
    recentLogins: source.recentLogins ?? [],
    cards: {
      addedDaily: source.cards?.addedDaily ?? [],
      addedWeekly: source.cards?.addedWeekly ?? [],
      learnedDaily: source.cards?.learnedDaily ?? [],
      learnedWeekly: source.cards?.learnedWeekly ?? [],
    },
    quiz: {
      ...EMPTY_ANALYTICS_DATA.quiz,
      ...source.quiz,
      dailyActivity: source.quiz?.dailyActivity ?? [],
      successByLanguage: source.quiz?.successByLanguage ?? [],
    },
    subscriptions: {
      ...EMPTY_ANALYTICS_DATA.subscriptions,
      ...source.subscriptions,
      byPlan: source.subscriptions?.byPlan ?? [],
      byStatus: source.subscriptions?.byStatus ?? [],
      byBillingCycle: source.subscriptions?.byBillingCycle ?? [],
      autoRenew: source.subscriptions?.autoRenew ?? [],
      upcomingRenewals: source.subscriptions?.upcomingRenewals ?? [],
      expiringUsers: source.subscriptions?.expiringUsers ?? [],
      monthlyRevenueByPlan: source.subscriptions?.monthlyRevenueByPlan ?? [],
      freeToPaidTransitions: { ...EMPTY_ANALYTICS_DATA.subscriptions.freeToPaidTransitions, ...source.subscriptions?.freeToPaidTransitions },
    },
    reviews: {
      ...EMPTY_ANALYTICS_DATA.reviews,
      ...source.reviews,
      daily: source.reviews?.daily ?? [],
      weekly: source.reviews?.weekly ?? [],
      distribution: source.reviews?.distribution ?? [],
    },
    customCards: {
      ...EMPTY_ANALYTICS_DATA.customCards,
      ...source.customCards,
      topProducers: source.customCards?.topProducers ?? [],
      daily: source.customCards?.daily ?? [],
    },
  };
  const [registrationPeriod, setRegistrationPeriod] = useState<AnalyticsPeriod>("weekly"); const [cardPeriod, setCardPeriod] = useState<AnalyticsPeriod>("weekly"); const [reviewPeriod, setReviewPeriod] = useState<AnalyticsPeriod>("weekly");
  const registrationSeries = analytics.registrations[registrationPeriod];
  const cardSeries = useMemo(() => ({ added: (cardPeriod === "daily" ? analytics.cards.addedDaily : analytics.cards.addedWeekly) ?? [], learned: (cardPeriod === "daily" ? analytics.cards.learnedDaily : analytics.cards.learnedWeekly) ?? [] }), [analytics.cards, cardPeriod]);
  const reviewSeries = reviewPeriod === "daily" ? analytics.reviews.daily : analytics.reviews.weekly;
  const paidUsers = (analytics.subscriptions.byPlan.find((item) => item.key === "basic")?.value ?? 0) + (analytics.subscriptions.byPlan.find((item) => item.key === "pro")?.value ?? 0);
  const last30Registrations = analytics.registrations.daily.reduce((sum, item) => sum + item.value, 0); const last30CustomCards = analytics.customCards.daily.reduce((sum, item) => sum + item.value, 0);
  return <main className="min-h-[calc(100dvh-4rem)] bg-[#f5f3ee] px-4 py-6 text-[#1f2922] sm:px-6 lg:px-10"><div className="mx-auto max-w-[104rem]">
    <header className="border-b border-[#d9ddd4] pb-6"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#4f6657] hover:underline" href="/developer"><ArrowLeft className="size-4" aria-hidden="true" />Developer workspace</Link><h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">Analytics</h1></header>
    <div className="mt-4 flex flex-wrap justify-end gap-2"><span className="inline-flex items-center gap-2 rounded-lg border border-[#d9ddd4] bg-[#fcfbf8] px-3 py-2 text-xs font-semibold text-[#647168]"><RefreshCw className="size-3.5" /> Canlı Supabase verisi</span><Link className="inline-flex items-center justify-center rounded-lg border border-[#ccd4c9] bg-[#fcfbf8] px-3 py-2 text-sm font-semibold text-[#405548] transition-colors hover:bg-white" href="/developer/admin">Admin panele dön</Link></div>
    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8" aria-label="Ana metrikler"><MetricCard label="Toplam kullanıcı" value={formatNumber(analytics.totalUsers)} detail="Auth kullanıcıları" icon={Users} palette="emerald" /><MetricCard label="Son 30 gün kayıt" value={formatNumber(last30Registrations)} detail="Yeni kullanıcı" icon={Activity} palette="blue" /><MetricCard label="Öğrenilmiş kart" value={formatNumber(initialStats.learnedCards)} detail={`${formatNumber(initialStats.totalCards)} toplam kart kaydı`} icon={Layers3} palette="violet" /><MetricCard label="Quiz denemesi" value={formatNumber(analytics.quiz.totalAttempts)} detail={`Kullanıcı başına ${decimalFormatter.format(analytics.quiz.averageAttemptsPerUser)}`} icon={BarChart3} palette="orange" /><MetricCard label="Quiz doğruluk" value={`%${decimalFormatter.format(analytics.quiz.accuracyPercent)}`} detail={`${formatNumber(analytics.quiz.correctAttempts)} doğru cevap`} icon={CheckCircle2} palette="teal" /><MetricCard label="Ücretli kullanıcı" value={formatNumber(paidUsers)} detail={`${formatNumber(analytics.subscriptions.googlePlayCount)} Google Play`} icon={CreditCard} palette="amber" /><MetricCard label="Aylık gelir" value={tryFormatter.format(initialStats.monthlyRevenueTry)} detail="Doğrulanmış yenilemeler" icon={CircleDollarSign} palette="pink" /><MetricCard label="Ortalama puan" value={analytics.reviews.averageRating ? `${decimalFormatter.format(analytics.reviews.averageRating)} / 5` : "—"} detail={`${formatNumber(analytics.reviews.distribution.reduce((sum, item) => sum + item.value, 0))} review`} icon={Star} palette="indigo" /></section>
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
      <ChartCard title="DAU / WAU / MAU" description="Tekil aktif kullanıcılar; giriş eventleri varsa gerçek uygulama aktivitesinden hesaplanır."><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><RetentionKpi label="DAU" value={formatNumber(analytics.activity.dau)} detail="Son 24 saat" /><RetentionKpi label="WAU" value={formatNumber(analytics.activity.wau)} detail="Son 7 gün" /><RetentionKpi label="MAU" value={formatNumber(analytics.activity.mau)} detail="Son 30 gün" /><RetentionKpi label="Stickiness" value={formatPercent(analytics.activity.stickinessPercent)} detail="DAU / MAU" /></div><div className="mt-5"><LineChart series={analytics.activity.dailyActiveUsers} valueLabel="Aktif kullanıcı" /></div></ChartCard>
      <section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><PanelBar accent="#f04444"><h2 className="text-sm font-semibold text-white">Onboarding funnel</h2></PanelBar><div className="flex items-start gap-3"><ListChecks className="mt-0.5 size-5 text-[#4d8a65]" /><div><p className="mt-1 text-xs leading-5 text-[#7b867e]">Kayıttan ilk quiz deneyimine kadar dönüşüm.</p></div></div><div className="mt-5"><DistributionList items={analytics.onboardingFunnel} /></div></section>
    </section>
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><PanelBar accent="#06a6d4"><h2 className="text-sm font-semibold text-white">Uygulama sağlığı</h2></PanelBar><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-[#4d8a65]" /><div><p className="mt-1 text-xs leading-5 text-[#7b867e]">Kalıcı olarak izlenen olaylar ve kayıtlı AI hata sinyalleri.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><RetentionKpi label="İzlenen olay" value={formatNumber(analytics.appHealth.trackedEvents)} detail="Toplam kayıt" /><RetentionKpi label="AI hata olayı" value={formatNumber(analytics.appHealth.errorEvents)} detail="Kalıcı hata event’i" /><RetentionKpi label="Hata oranı" value={formatPercent(analytics.appHealth.errorRatePercent)} detail="AI event’leri içinde" /><RetentionKpi label="Son aktivite" value={analytics.appHealth.lastActivityAt ? formatShortDate(analytics.appHealth.lastActivityAt) : "—"} detail={analytics.appHealth.dataSource === "tracked_events" ? "İzlenen event’lerden" : "Henüz event yok"} /></div></section>
      <section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><PanelBar accent="#9a3fd1"><h2 className="text-sm font-semibold text-white">Özellik kullanımı</h2></PanelBar><div className="flex items-start gap-3"><MousePointerClick className="mt-0.5 size-5 text-[#5d83c5]" /><div><p className="mt-1 text-xs leading-5 text-[#7b867e]">Quiz, kart, AI ve review aksiyonlarının toplam hacmi.</p></div></div><div className="mt-5"><DistributionList items={analytics.featureUsage} valueSuffix="kullanım" emptyText="Henüz özellik kullanım event’i yok." /></div></section>
    </section>
    <section className="mt-4 overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5">
      <PanelBar accent={analyticsAccent("Retention eğrisi")}><h2 className="text-sm font-semibold text-white">Retention</h2></PanelBar>
      <div className="flex flex-col gap-3 border-b border-[#e6e9e2] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="text-xs leading-5 text-[#7b867e]">Kayıt olan kullanıcıların uygulamaya geri dönme oranı ve kohort performansı.</p></div>
        <span className="inline-flex items-center rounded-lg bg-[#f1f4ee] px-3 py-2 text-xs font-semibold text-[#596e60]">{analytics.retention.dataSource === "login_events" ? "Giriş eventleri" : "Auth son giriş fallback"}</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {analytics.retention.metrics.map((metric) => <RetentionKpi key={metric.key} label={metric.label} value={metric.eligibleUsers > 0 ? formatPercent(metric.value) : "—"} detail={metric.eligibleUsers > 0 ? `${formatNumber(metric.retainedUsers)} / ${formatNumber(metric.eligibleUsers)} kullanıcı` : "Yeterli kohort oluşmadı"} />)}
        <RetentionKpi label="Aktif · 7 gün" value={formatNumber(analytics.retention.activeUsers7d)} detail="Son 7 günde giriş yapan" />
        <RetentionKpi label="Aktif · 30 gün" value={formatNumber(analytics.retention.activeUsers30d)} detail="Son 30 günde giriş yapan" />
        <RetentionKpi label="Geri dönen · 30 gün" value={formatNumber(analytics.retention.returningUsers30d)} detail="İlk günden sonra dönen" />
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(26rem,1fr)]">
        <ChartCard title="Retention eğrisi" description="Kayıt sonrası D+1, D+7, D+14 ve D+30 geri dönüş oranları."><LineChart series={analytics.retention.metrics.map((metric) => ({ key: metric.key, label: metric.label, value: metric.value }))} valueLabel="Retention" /></ChartCard>
        <section className="overflow-hidden rounded-xl border border-[#e1e6de] bg-[#f8faf6] p-4">
          <PanelBar accent="#f29b16" inset="4"><h3 className="text-sm font-semibold text-white">Kohort görünümü</h3></PanelBar>
          <div><p className="text-xs leading-5 text-[#7b867e]">Haftalık kayıt kohortlarının yaşa göre retention oranları.</p></div>
          <div className="mt-4 overflow-x-auto">
            {analytics.retention.cohorts.length === 0 ? <EmptyTable text="Retention kohortu için henüz yeterli veri yok." /> : <table className="w-full min-w-[30rem] text-xs"><thead><tr className="border-b border-[#e1e6de] text-left text-[10px] font-semibold text-[#89938b]"><th className="px-2 py-2">Kohort</th><th className="px-2 py-2 text-right">Yeni</th><th className="px-2 py-2 text-right">D+1</th><th className="px-2 py-2 text-right">D+7</th><th className="px-2 py-2 text-right">D+14</th><th className="px-2 py-2 text-right">D+30</th></tr></thead><tbody>{analytics.retention.cohorts.map((cohort) => <tr className="border-b border-[#edf0ea] last:border-0" key={cohort.key}><td className="px-2 py-2.5 font-medium text-[#445247]">{cohort.label}</td><td className="px-2 py-2.5 text-right tabular-nums text-[#718078]">{formatNumber(cohort.cohortSize)}</td><td className="px-2 py-2.5 text-right tabular-nums text-[#596e60]">{formatPercent(cohort.day1)}</td><td className="px-2 py-2.5 text-right tabular-nums text-[#596e60]">{formatPercent(cohort.day7)}</td><td className="px-2 py-2.5 text-right tabular-nums text-[#596e60]">{formatPercent(cohort.day14)}</td><td className="px-2 py-2.5 text-right tabular-nums text-[#596e60]">{formatPercent(cohort.day30)}</td></tr>)}</tbody></table>}
          </div>
        </section>
      </div>
    </section>
    <section className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5">
        <PanelBar accent="#0ea5e9"><h2 className="text-sm font-semibold text-white">Dil profili</h2></PanelBar>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs leading-5 text-[#7b867e]">Kullanıcıların ana dil / onboarding seçimi.</p></div>
          <Globe2 className="size-5 text-[#4d8a65]" />
        </div>
        <div className="mt-5"><DistributionList items={analytics.nativeLanguageDistribution} /></div>
        <p className="mt-5 border-t border-[#e6e9e2] pt-3 text-[11px] leading-5 text-[#89938b]">Ayrı bir native-language geçmişi tutulmadığı için profil alanındaki onboarding/UI locale kaydı kullanılıyor.</p>
      </section>
      <section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5">
        <PanelBar accent="#d92578"><h2 className="text-sm font-semibold text-white">Öğrenilen dil</h2></PanelBar>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs leading-5 text-[#7b867e]">Kullanıcıların öğrenmek için seçtiği diller.</p></div>
          <Globe2 className="size-5 text-[#5d83c5]" />
        </div>
        <div className="mt-5"><DistributionList items={analytics.learningLanguageDistribution} /></div>
      </section>
    </section>
    <section className="mt-4 grid gap-4 xl:grid-cols-2">
      <ChartCard title="Yeni kayıtlar" description="Günlük, haftalık veya aylık kullanıcı kayıt trendi." period={registrationPeriod} onPeriodChange={setRegistrationPeriod}><LineChart series={registrationSeries} valueLabel="Yeni kayıt" /></ChartCard>
      <ChartCard title="Günlük uygulama girişleri" description="Son 30 günde kaydedilen başarılı uygulama girişleri."><LineChart series={analytics.dailyAppLogins} valueLabel="Giriş" /></ChartCard>
    </section>
    <section className="mt-4 grid gap-4 lg:grid-cols-2"><ChartCard title="Kart hareketi" description="Eklenen ve öğrenilen kartların zaman içindeki hareketi." period={cardPeriod} onPeriodChange={setCardPeriod}><LineChart series={cardSeries.added.map((point, index) => ({ ...point, secondaryValue: cardSeries.learned[index]?.value ?? 0 }))} secondaryLabel="Öğrenilen" /><div className="mt-3 grid grid-cols-2 gap-3"><LegendStat label="Toplam eklenen" value={formatNumber(initialStats.totalCards)} color="bg-[#2f7251]" /><LegendStat label="Toplam öğrenilen" value={formatNumber(initialStats.learnedCards)} color="bg-[#5d83c5]" /></div></ChartCard><ChartCard title="Quiz aktivitesi" description="Son 30 gündeki toplam soru cevaplama aktivitesi."><LineChart series={analytics.quiz.dailyActivity} /><div className="mt-3 grid gap-2"><LegendStat label="Doğru" value={formatNumber(analytics.quiz.correctAttempts)} color="bg-[#2f7251]" /><LegendStat label="Yanlış" value={formatNumber(analytics.quiz.incorrectAttempts)} color="bg-[#c96b51]" /><LegendStat label="İlk quizini yapan" value={`%${decimalFormatter.format(analytics.quiz.firstQuizRatePercent)}`} color="bg-[#5d83c5]" /></div></ChartCard></section>
    <section className="mt-4 grid gap-4 lg:grid-cols-3"><section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><PanelBar accent="#06a6d4"><h2 className="text-sm font-semibold text-white">UI locale</h2></PanelBar><div className="flex items-start justify-between"><div><p className="mt-1 text-xs text-[#7b867e]">Arayüz dili tercihleri.</p></div><MessageSquareText className="size-5 text-[#5d83c5]" /></div><div className="mt-5"><DistributionList items={analytics.uiLocaleDistribution} /></div></section><section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><PanelBar accent="#11b86a"><h2 className="text-sm font-semibold text-white">Quiz başarı oranı</h2></PanelBar><div className="flex items-start justify-between"><div><p className="mt-1 text-xs text-[#7b867e]">Öğrenme diline göre doğru cevap.</p></div><CheckCircle2 className="size-5 text-[#4d8a65]" /></div><div className="mt-5"><DistributionList items={analytics.quiz.successByLanguage} valueSuffix="deneme" emptyText="Dil bilgisi çıkarılabilecek quiz yok." /></div></section><section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><PanelBar accent="#f29b16"><h2 className="text-sm font-semibold text-white">Review puan dağılımı</h2></PanelBar><div className="flex items-start justify-between"><div><p className="mt-1 text-xs text-[#7b867e]">Kullanıcı memnuniyetinin görünümü.</p></div><Star className="size-5 text-[#d19432]" /></div><div className="mt-5"><DistributionList items={analytics.reviews.distribution} valueSuffix="review" /></div></section></section>
    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"><ChartCard title="Abonelik dağılımı" description="Plan, durum ve yenileme tercihleri."><div className="grid gap-6 sm:grid-cols-2"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#829087]">Plan</p><DistributionList items={analytics.subscriptions.byPlan} /></div><div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#829087]">Durum</p><DistributionList items={analytics.subscriptions.byStatus.map((item) => ({ ...item, label: statusLabel(item.key) }))} /></div><div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#829087]">Faturalandırma</p><DistributionList items={analytics.subscriptions.byBillingCycle} /></div><div><p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#829087]">Otomatik yenileme</p><DistributionList items={analytics.subscriptions.autoRenew} /></div></div></ChartCard><section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><PanelBar accent="#f29b16"><h2 className="text-sm font-semibold text-white">Gelir görünümü</h2></PanelBar><div className="flex items-start justify-between"><div><p className="mt-1 text-xs leading-5 text-[#7b867e]">Google Play doğrulamasındaki aylık TL karşılığı.</p></div><CircleDollarSign className="size-5 text-[#c28628]" /></div><div className="mt-5 space-y-4"><LegendStat label="Basic aylık gelir" value={tryFormatter.format(analytics.subscriptions.monthlyRevenueByPlan.find((item) => item.key === "basic")?.value ?? 0)} color="bg-[#5d83c5]" /><LegendStat label="Pro aylık gelir" value={tryFormatter.format(analytics.subscriptions.monthlyRevenueByPlan.find((item) => item.key === "pro")?.value ?? 0)} color="bg-[#8b68c9]" /><div className="border-t border-[#e6e9e2] pt-4"><LegendStat label="Abonelik başına ortalama" value={tryFormatter.format(analytics.subscriptions.averageRevenuePerSubscription)} color="bg-[#2f7251]" /></div><div className="border-t border-[#e6e9e2] pt-4"><LegendStat label="Google Play aboneliği" value={formatNumber(analytics.subscriptions.googlePlayCount)} color="bg-[#d19432]" /><LegendStat label="Free → ücretli geçiş" value={analytics.subscriptions.freeToPaidTransitions.available ? formatNumber(analytics.subscriptions.freeToPaidTransitions.basic + analytics.subscriptions.freeToPaidTransitions.pro) : "Veri yok"} color="bg-[#9b4b35]" /></div><p className="text-[11px] leading-5 text-[#89938b]">Geçiş sayısı, kaydedilmiş Google Play ilk satın alma (RTDN) event’lerinden hesaplanır.</p></div></section></section>
    <section className="mt-4 grid gap-4 lg:grid-cols-2"><ChartCard title="Review aktivitesi" description="Günlük veya haftalık yeni review sayısı." period={reviewPeriod} onPeriodChange={setReviewPeriod}><LineChart series={reviewSeries} /></ChartCard><ChartCard title="Özel kart üretimi" description="AI ile oluşturulan özel kartların günlük üretimi."><LineChart series={analytics.customCards.daily} /><div className="mt-3 grid gap-2"><LegendStat label="Son 30 gün üretim" value={formatNumber(last30CustomCards)} color="bg-[#8b68c9]" /><LegendStat label="AI üretim hatası" value={analytics.customCards.generationErrorDataAvailable ? formatNumber(analytics.customCards.generationErrors) : "Loglanmıyor"} color="bg-[#c96b51]" /></div><p className="mt-3 text-[11px] leading-5 text-[#89938b]">AI özel kart hata olayları şu an Supabase’e kalıcı olarak yazılmadığı için hata metriği gösterilmiyor.</p></ChartCard></section>
    <section className="mt-4 grid gap-4 lg:grid-cols-2"><DataTable title="Son giriş yapanlar" icon={Users} headers={["Kullanıcı", "Sağlayıcı", "Son giriş"]}>{analytics.recentLogins.length === 0 ? <EmptyTable text="Henüz giriş aktivitesi yok." /> : analytics.recentLogins.map((user) => <div className="grid grid-cols-[minmax(0,1fr)_5rem_7rem] items-center gap-3 border-t border-[#edf0ea] px-1 py-3 text-xs" key={user.id}><div className="min-w-0"><p className="truncate font-semibold text-[#445247]">{user.displayName ?? "İsimsiz kullanıcı"}</p><p className="truncate text-[#89938b]">{user.email ?? "E-posta yok"}</p></div><span className="truncate text-[#718078]">{user.provider}</span><time className="text-right tabular-nums text-[#718078]">{formatDate(user.lastSignInAt)}</time></div>)}</DataTable><DataTable title="En çok özel kart üretenler" icon={Layers3} headers={["Kullanıcı", "Kart"]}>{analytics.customCards.topProducers.length === 0 ? <EmptyTable text="Henüz özel kart üretilmemiş." /> : analytics.customCards.topProducers.map((user) => <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-3 border-t border-[#edf0ea] px-1 py-3 text-xs" key={user.id}><div className="min-w-0"><p className="truncate font-semibold text-[#445247]">{user.displayName ?? "İsimsiz kullanıcı"}</p><p className="truncate text-[#89938b]">{user.email ?? "E-posta yok"}</p></div><strong className="text-right tabular-nums text-[#26342b]">{formatNumber(user.value)}</strong></div>)}</DataTable></section>
    <section className="mt-4 grid gap-4 lg:grid-cols-2"><DataTable title="Yaklaşan yenilemeler" icon={CalendarClock} headers={["Kullanıcı", "Plan", "Tarih"]}>{analytics.subscriptions.upcomingRenewals.length === 0 ? <EmptyTable text="Önümüzdeki 30 günde kayıtlı yenileme yok." /> : analytics.subscriptions.upcomingRenewals.map((item) => <div className="grid grid-cols-[minmax(0,1fr)_4rem_6rem] items-center gap-3 border-t border-[#edf0ea] px-1 py-3 text-xs" key={`${item.id}-${item.date}`}><div className="min-w-0"><p className="truncate font-semibold text-[#445247]">{item.displayName ?? "İsimsiz kullanıcı"}</p><p className="truncate text-[#89938b]">{item.email ?? "E-posta yok"}</p></div><span className="font-semibold capitalize text-[#596e60]">{item.plan}</span><time className="text-right tabular-nums text-[#718078]">{formatShortDate(item.date)}</time></div>)}</DataTable><DataTable title="Erişimi bitecek kullanıcılar" icon={XCircle} headers={["Kullanıcı", "Plan", "Bitiş"]}>{analytics.subscriptions.expiringUsers.length === 0 ? <EmptyTable text="Önümüzdeki 30 günde erişimi bitecek kullanıcı yok." /> : analytics.subscriptions.expiringUsers.map((item) => <div className="grid grid-cols-[minmax(0,1fr)_4rem_6rem] items-center gap-3 border-t border-[#edf0ea] px-1 py-3 text-xs" key={`${item.id}-${item.date}`}><div className="min-w-0"><p className="truncate font-semibold text-[#445247]">{item.displayName ?? "İsimsiz kullanıcı"}</p><p className="truncate text-[#89938b]">{item.email ?? "E-posta yok"}</p></div><span className="font-semibold capitalize text-[#596e60]">{item.plan}</span><time className="text-right tabular-nums text-[#718078]">{formatShortDate(item.date)}</time></div>)}</DataTable></section>
    <DeveloperLeaderboards />
    <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#d9ddd4] pt-4 text-xs text-[#89938b]"><span>Veriler server-side service role ile okunur; ham Supabase erişimi tarayıcıya açılmaz.</span><Link className="inline-flex items-center gap-1 font-semibold text-[#4f6657] hover:underline" href="/developer/admin">Kullanıcı detaylarına git <ChevronRight className="size-3.5" /></Link></footer>
  </div></main>;
}

function DataTable({ title, icon: Icon, headers, children }: { title: string; icon: typeof Users; headers: string[]; children: React.ReactNode }) {
  const columns = headers.length > 2 ? "grid-cols-[minmax(0,1fr)_5rem_7rem]" : "grid-cols-[minmax(0,1fr)_4rem]";
  return <section className="overflow-hidden rounded-xl border border-[#d9ddd4] bg-[#fcfbf8] p-5"><PanelBar accent={analyticsAccent(title)}><Icon className="size-4 text-white" /><h2 className="text-sm font-semibold text-white">{title}</h2></PanelBar><div className={`mt-4 grid ${columns} gap-3 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9aa49c]`}>{headers.map((header) => <span key={header}>{header}</span>)}</div><div className="mt-1">{children}</div></section>;
}
