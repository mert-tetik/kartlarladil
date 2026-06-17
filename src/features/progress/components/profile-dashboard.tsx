"use client";

import Link from "next/link";
import { BarChart3, BookOpen, Boxes, CheckCircle2, Trophy } from "lucide-react";
import { LANGUAGES } from "@/data/languages";
import { TIER_STYLES } from "@/data/tiers";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { getCardTranslation } from "@/features/cards/card-localization";
import { joinInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useProgressStats } from "@/features/progress/progress-client";
import { PlanBadge } from "@/features/subscriptions/components/plan-badge";
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatNumber,
  formatPoints,
  getLanguageDisplayName,
  getRankLabel,
  getTierLabel,
} from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";

export function ProfileDashboard({ user }: { user: AuthShellUser }) {
  const { stats, loading, error } = useProgressStats();
  const { entitlements } = useSubscription();
  const effectivePlan = entitlements?.effectivePlan ?? "free";
  const cards = useInventoryStore((state) => state.cards);
  const attempts = useInventoryStore((state) => state.attempts);
  const { locale } = useLocale();
  const t = useT();
  const joinedCards = joinInventoryCards(cards);
  const learnedCards = joinedCards
    .filter((item) => item.inventory.status === "learned")
    .sort((a, b) => (b.inventory.learnedAt ?? "").localeCompare(a.inventory.learnedAt ?? ""))
    .slice(0, 8);
  const cardById = new Map(joinedCards.map((item) => [item.card.id, item.card]));

  if (loading) {
    return <EmptyState icon={BarChart3} title={t("profile.loadingTitle")} description={t("profile.loadingDescription")} />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-background-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-lg bg-background-inverse text-2xl font-bold text-foreground-inverse">
              {(user.profile.displayName?.[0] ?? user.email[0]).toLocaleUpperCase(locale)}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground-muted">{user.email}</p>
              <h2 className="mt-1 font-display text-4xl font-semibold text-foreground">
                {user.profile.displayName || t("profile.fallbackName")}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <PlanBadge />
                <span className="text-sm text-foreground-secondary">{getRankLabel(stats.rank, locale)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {effectivePlan !== "pro" ? (
              <Link
                href="/pricing"
                className={buttonClassName("primary", "sm", "w-full text-center")}
              >
                {t("profile.upgradePlan")}
              </Link>
            ) : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
              <StatTile icon={Trophy} label={t("profile.points")} value={formatNumber(locale, stats.totalPoints)} />
              <StatTile icon={CheckCircle2} label={t("profile.learned")} value={formatNumber(locale, stats.learnedCards)} />
              <StatTile icon={Boxes} label={t("profile.pool")} value={formatNumber(locale, stats.totalCards)} />
              <StatTile icon={BookOpen} label={t("profile.active")} value={formatNumber(locale, stats.activeCards)} />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span className="text-foreground-secondary">{getRankLabel(stats.rank, locale)}</span>
            <span className="text-foreground-muted">
              {stats.nextRank
                ? t("profile.nextRank", {
                    rank: getRankLabel(stats.nextRank, locale),
                    points: formatNumber(locale, stats.pointsToNextRank),
                  })
                : t("profile.finalRank")}
            </span>
          </div>
          <Progress value={stats.rankProgressPercent} indicatorClassName="bg-background-inverse" className="mt-3" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-border bg-background-card p-5">
          <h3 className="font-semibold text-foreground">{t("profile.tierCollection")}</h3>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {stats.tierStats.map((tier) => {
              const style = TIER_STYLES[tier.tier];

              return (
                <div key={tier.tier} className={cn("rounded-lg border bg-gradient-to-br p-3 text-center", style.border, style.surface)}>
                  <span className={cn("text-sm font-bold", style.text)}>{tier.tier}</span>
                  <p className="mt-1 text-[11px] font-semibold text-foreground-muted dark:text-foreground-inverse/70">{getTierLabel(tier.tier, locale)}</p>
                  <p className="mt-3 text-2xl font-bold text-foreground">{formatNumber(locale, tier.learned)}</p>
                  <p className="mt-1 text-[11px] font-semibold text-foreground-muted dark:text-foreground-inverse/70">{formatPoints(locale, tier.points)}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background-card p-5">
          <h3 className="font-semibold text-foreground">{t("profile.languageProgress")}</h3>
          <div className="mt-4 space-y-3">
            {stats.languageStats.map((language) => {
              const meta = LANGUAGES.find((item) => item.code === language.language)!;
              const percent = language.total > 0 ? Math.round((language.learned / language.total) * 100) : 0;

              return (
                <div key={language.language} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{getLanguageDisplayName(meta.code, locale)}</p>
                      <p className="mt-1 text-xs font-semibold text-foreground-muted">
                        {t("profile.languageCardCount", {
                          learned: formatNumber(locale, language.learned),
                          total: formatNumber(locale, language.total),
                        })}
                      </p>
                    </div>
                    <Badge>{formatPoints(locale, language.points)}</Badge>
                  </div>
                  <Progress value={percent} className="mt-3" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-background-card p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">{t("profile.recentLearned")}</h3>
            <Link href="/learned" className={buttonClassName("secondary", "sm")}>
              {t("common.viewAll")}
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {learnedCards.length > 0 ? (
              learnedCards.map(({ card, inventory }) => (
                <div key={card.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3">
                  <div>
                    <p className="font-display text-xl font-semibold text-foreground">{card.term}</p>
                    <p className="mt-1 text-sm text-foreground-muted">{getCardTranslation(card, locale)}</p>
                  </div>
                  <Badge className={TIER_STYLES[card.tier].text}>{card.tier}</Badge>
                  <span className="sr-only">{inventory.learnedAt}</span>
                </div>
              ))
            ) : (
              <EmptyInline message={t("profile.noLearned")} />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background-card p-5">
          <h3 className="font-semibold text-foreground">{t("profile.recentAttempts")}</h3>
          <div className="mt-4 space-y-2">
            {attempts.slice(0, 8).length > 0 ? (
              attempts.slice(0, 8).map((attempt) => {
                const card = cardById.get(attempt.cardId);

                return (
                  <div key={attempt.id} className="rounded-md border border-border bg-background p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-foreground">{card?.term ?? attempt.cardId}</p>
                      <Badge className={attempt.isCorrect ? "text-emerald-700" : "text-rose-700"}>
                        {attempt.isCorrect ? t("common.correct") : t("common.incorrect")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-foreground-muted">
                      {t("common.answer")}: {attempt.selectedAnswer}
                    </p>
                  </div>
                );
              })
            ) : (
              <EmptyInline message={t("profile.noAttempts")} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <Icon className="size-4 text-foreground-muted" aria-hidden="true" />
      <p className="mt-3 text-xs font-semibold text-foreground-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function EmptyInline({ message }: { message: string }) {
  return <p className="rounded-md border border-dashed border-border p-4 text-sm font-semibold text-foreground-muted">{message}</p>;
}
