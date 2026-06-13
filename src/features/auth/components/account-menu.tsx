"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, LogOut, Settings, Shield, UserRound } from "lucide-react";
import { TIER_STYLES } from "@/data/tiers";
import { logoutAction } from "@/features/auth/actions";
import { getAccountInitial, getAccountLabel } from "@/features/auth/account-display";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { useProgressStats } from "@/features/progress/progress-client";
import { RankIcon, getRankIconTone } from "@/features/progress/rank-icons";
import { formatNumber, getRankLabel, getTierLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function AccountMenu({ user }: { user: AuthShellUser }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = getAccountInitial(user);
  const { stats } = useProgressStats();
  const { locale } = useLocale();
  const t = useT();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("auth.accountMenu")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex size-10 items-center justify-center rounded-full border border-slate-200 bg-slate-950 text-sm font-bold text-white transition-colors hover:bg-slate-800",
          open && "ring-2 ring-slate-300",
        )}
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-72 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-sm"
        >
          <div className="px-3 py-3">
            <p className="font-semibold text-slate-950">{getAccountLabel(user)}</p>
            <p className="mt-1 truncate text-slate-500">{user.email}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">{t("rank.current")}</p>
                <p className="mt-1 font-semibold text-slate-950">{getRankLabel(stats.rank, locale)}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-950">
                <RankIcon icon={stats.rank.icon} className={cn("size-4", getRankIconTone(stats.rank.icon))} />
                {formatNumber(locale, stats.totalPoints)}
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-slate-950" style={{ width: `${stats.rankProgressPercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {stats.nextRank
                ? t("rank.next", {
                    rank: getRankLabel(stats.nextRank, locale),
                    points: formatNumber(locale, stats.pointsToNextRank),
                  })
                : t("rank.completed")}
            </p>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {stats.tierStats.map((tier) => {
                const style = TIER_STYLES[tier.tier];

                return (
                  <div
                    key={tier.tier}
                    className={cn("rounded-md border bg-white p-2 text-center", style.border)}
                    title={`${tier.tier} ${getTierLabel(tier.tier, locale)}: ${tier.learned}`}
                  >
                    <span className={cn("block text-xs font-bold", style.text)}>{tier.tier}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-slate-600">{tier.learned}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="h-px bg-slate-200" />
          <MenuLink href="/profile" icon={BarChart3} label={t("page.profile.title")} />
          <MenuLink href="/account/settings" icon={Settings} label={t("page.account.title")} />
          <MenuLink href="/account/update-password" icon={Shield} label={t("auth.updatePassword.title")} />
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {t("auth.logout")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof UserRound;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="mt-1 flex items-center gap-3 rounded-md px-3 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
