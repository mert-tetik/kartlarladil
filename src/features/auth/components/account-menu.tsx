"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3, CreditCard, LogOut, Palette, Settings, Shield, UserRound, Vibrate } from "lucide-react";
import { TIER_STYLES } from "@/data/tiers";
import { logoutAction } from "@/features/auth/actions";
import { getAccountInitial, getAccountLabel } from "@/features/auth/account-display";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { useProgressStats } from "@/features/progress/progress-client";
import { PlanBadge } from "@/features/subscriptions/components/plan-badge";
import { RankIcon, getRankIconTone } from "@/features/progress/rank-icons";
import { ThemePickerDialog } from "@/features/auth/components/theme-picker-dialog";
import { formatNumber, getRankLabel, getTierLabel } from "@/i18n/labels";
import { useLocale, useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { useVibration } from "@/lib/vibration";

export function AccountMenu({ user }: { user: AuthShellUser }) {
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = getAccountInitial(user);
  const { stats } = useProgressStats();
  const { locale } = useLocale();
  const t = useT();
  const { supported: vibrationSupported, enabled: vibrationEnabled, toggle: toggleVibration } = useVibration();

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
      <div className="relative">
        <button
          type="button"
          aria-label={t("auth.accountMenu")}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "relative flex size-10 items-center justify-center rounded-full border border-border bg-background-inverse text-sm font-bold text-foreground-inverse transition-colors hover:bg-background-inverse",
            open && "ring-2 ring-border",
          )}
        >
          {initial}
          <PlanBadge className="absolute -bottom-2 left-1/2 z-10 -translate-x-1/2 border-2 border-foreground-inverse px-1.5 py-0 text-[10px] shadow-sm" />
        </button>
      </div>

      {open ? (
        <div
          role="menu"
          className="animate-menu-pop absolute right-0 top-12 z-50 w-72 rounded-lg border border-border bg-background-card p-2 text-sm shadow-2xl"
        >
          <div className="px-3 py-3">
            <p className="font-semibold text-foreground">{getAccountLabel(user)}</p>
            <p className="mt-1 truncate text-foreground-muted">{user.email}</p>
            <div className="mt-2">
              <Link
                href="/pricing"
                className="inline-block cursor-pointer rounded-md transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                <PlanBadge />
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground-muted">{t("rank.current")}</p>
                <p className="mt-1 font-semibold text-foreground">{getRankLabel(stats.rank, locale)}</p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-background-card px-3 py-1 text-sm font-bold text-foreground">
                <RankIcon icon={stats.rank.icon} className={cn("size-4", getRankIconTone(stats.rank.icon))} />
                {formatNumber(locale, stats.totalPoints)}
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-background-card">
              <div className="h-full rounded-full bg-background-inverse" style={{ width: `${stats.rankProgressPercent}%` }} />
            </div>
            <p className="mt-2 text-xs text-foreground-muted">
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
                    className={cn("rounded-md border bg-background-card p-2 text-center", style.border)}
                    title={`${tier.tier} ${getTierLabel(tier.tier, locale)}: ${tier.learned}`}
                  >
                    <span className={cn("block text-xs font-bold", style.text)}>{tier.tier}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-foreground-secondary">{tier.learned}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="h-px bg-border" />
          <MenuLink href="/profile" icon={BarChart3} label={t("page.profile.title")} />
          <MenuLink href="/account/settings" icon={Settings} label={t("page.account.title")} />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setThemeOpen(true);
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left font-semibold text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
          >
            <Palette className="size-4" aria-hidden="true" />
            {t("theme.title")}
          </button>
          <MenuLink href="/pricing" icon={CreditCard} label={t("account.subscription.title")} />
          <MenuLink href="/account/update-password" icon={Shield} label={t("auth.updatePassword.title")} />
          {vibrationSupported ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                toggleVibration();
              }}
              className="mt-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-semibold text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
            >
              <span className="flex items-center gap-3">
                <Vibrate className="size-4" aria-hidden="true" />
                {t("auth.vibration")}
              </span>
              <span
                role="switch"
                aria-checked={vibrationEnabled}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                  vibrationEnabled ? "bg-emerald-500" : "bg-background-muted",
                )}
              >
                <span
                  className={cn(
                    "inline-block size-3.5 transform rounded-full bg-white transition-transform",
                    vibrationEnabled ? "translate-x-[18px]" : "translate-x-0.5",
                  )}
                />
              </span>
            </button>
          ) : null}
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="mt-1 flex w-full items-center gap-3 rounded-md bg-red-600 px-3 py-2 text-left font-semibold text-foreground-inverse transition-colors hover:bg-red-700 focus-visible:outline-none"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {t("auth.logout")}
            </button>
          </form>
        </div>
      ) : null}
      <ThemePickerDialog open={themeOpen} onOpenChange={setThemeOpen} />
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
      className="mt-1 flex items-center gap-3 rounded-md px-3 py-2 font-semibold text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground"
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
