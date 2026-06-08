"use client";

import Link from "next/link";
import { BarChart3, BookOpen, Boxes, CheckCircle2, Trophy } from "lucide-react";
import { LANGUAGES } from "@/data/languages";
import { TIER_LABELS, TIER_STYLES } from "@/data/tiers";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { joinInventoryCards } from "@/features/inventory/inventory-selectors";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { useProgressStats } from "@/features/progress/progress-client";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function ProfileDashboard({ user }: { user: AuthShellUser }) {
  const { stats, loading, error } = useProgressStats();
  const cards = useInventoryStore((state) => state.cards);
  const attempts = useInventoryStore((state) => state.attempts);
  const joinedCards = joinInventoryCards(cards);
  const learnedCards = joinedCards
    .filter((item) => item.inventory.status === "learned")
    .sort((a, b) => (b.inventory.learnedAt ?? "").localeCompare(a.inventory.learnedAt ?? ""))
    .slice(0, 8);
  const cardById = new Map(joinedCards.map((item) => [item.card.id, item.card]));

  if (loading) {
    return <EmptyState icon={BarChart3} title="Profil hazırlanıyor" description="Puanların ve kart istatistiklerin okunuyor." />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-lg bg-slate-950 text-2xl font-bold text-white">
              {(user.profile.displayName?.[0] ?? user.email[0]).toLocaleUpperCase("tr")}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">{user.email}</p>
              <h2 className="mt-1 font-display text-4xl font-semibold text-slate-950">
                {user.profile.displayName || "Profil"}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{stats.rank.label}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <StatTile icon={Trophy} label="Puan" value={stats.totalPoints.toLocaleString("tr-TR")} />
            <StatTile icon={CheckCircle2} label="Öğrenildi" value={String(stats.learnedCards)} />
            <StatTile icon={Boxes} label="Havuz" value={String(stats.totalCards)} />
            <StatTile icon={BookOpen} label="Aktif" value={String(stats.activeCards)} />
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span className="text-slate-700">{stats.rank.label}</span>
            <span className="text-slate-500">
              {stats.nextRank ? `${stats.nextRank.label} için ${stats.pointsToNextRank} puan` : "Son rank"}
            </span>
          </div>
          <Progress value={stats.rankProgressPercent} indicatorClassName="bg-slate-950" className="mt-3" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-950">Tier koleksiyonu</h3>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {stats.tierStats.map((tier) => {
              const style = TIER_STYLES[tier.tier];

              return (
                <div key={tier.tier} className={cn("rounded-lg border bg-gradient-to-br p-3 text-center", style.border, style.surface)}>
                  <span className={cn("text-sm font-bold", style.text)}>{tier.tier}</span>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{TIER_LABELS[tier.tier]}</p>
                  <p className="mt-3 text-2xl font-bold text-slate-950">{tier.learned}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{tier.points} puan</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-950">Dil ilerlemesi</h3>
          <div className="mt-4 space-y-3">
            {stats.languageStats.map((language) => {
              const meta = LANGUAGES.find((item) => item.code === language.language)!;
              const percent = language.total > 0 ? Math.round((language.learned / language.total) * 100) : 0;

              return (
                <div key={language.language} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{meta.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{language.learned}/{language.total} kart</p>
                    </div>
                    <Badge>{language.points} puan</Badge>
                  </div>
                  <Progress value={percent} className="mt-3" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-950">Son öğrenilen kartlar</h3>
            <Link href="/ogrenilenler" className={buttonClassName("secondary", "sm")}>
              Tümünü gör
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {learnedCards.length > 0 ? (
              learnedCards.map(({ card, inventory }) => (
                <div key={card.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div>
                    <p className="font-display text-xl font-semibold text-slate-950">{card.term}</p>
                    <p className="mt-1 text-sm text-slate-500">{card.translation}</p>
                  </div>
                  <Badge className={TIER_STYLES[card.tier].text}>{card.tier}</Badge>
                  <span className="sr-only">{inventory.learnedAt}</span>
                </div>
              ))
            ) : (
              <EmptyInline message="Henüz öğrenilmiş kart yok." />
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-950">Son alıştırmalar</h3>
          <div className="mt-4 space-y-2">
            {attempts.slice(0, 8).length > 0 ? (
              attempts.slice(0, 8).map((attempt) => {
                const card = cardById.get(attempt.cardId);

                return (
                  <div key={attempt.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-950">{card?.term ?? attempt.cardId}</p>
                      <Badge className={attempt.isCorrect ? "text-emerald-700" : "text-rose-700"}>
                        {attempt.isCorrect ? "Doğru" : "Yanlış"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">Cevap: {attempt.selectedAnswer}</p>
                  </div>
                );
              })
            ) : (
              <EmptyInline message="Henüz alıştırma kaydı yok." />
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
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <Icon className="size-4 text-slate-500" aria-hidden="true" />
      <p className="mt-3 text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function EmptyInline({ message }: { message: string }) {
  return <p className="rounded-md border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">{message}</p>;
}
