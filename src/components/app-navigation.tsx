"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CircleHelp,
  CreditCard,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { CardsIcon } from "@/components/icons/cards-icon";
import { CardDecksIcon } from "@/components/icons/card-decks-icon";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonClassName } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { AccountMenu } from "@/features/auth/components/account-menu";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { RankProgressPopover } from "@/features/progress/components/rank-progress-popover";
import { useProgressStats } from "@/features/progress/progress-client";
import { useT } from "@/i18n/locale-provider";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n/dictionaries";

type NavItem = {
  href: string;
  labelKey: TranslationKey;
  mobileLabelKey?: TranslationKey;
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
};

const navItems: readonly NavItem[] = [
  { href: "/card-draw", labelKey: "nav.cardDraw", icon: CardsIcon },
  { href: "/my-cards", labelKey: "nav.inventory", icon: CardDecksIcon },
  { href: "/learn", labelKey: "nav.learn", icon: BookOpen },
  { href: "/ai-practice", labelKey: "nav.aiPractice", mobileLabelKey: "nav.aiPracticeShort", icon: MessageCircle },
  { href: "/ask", labelKey: "nav.ask", mobileLabelKey: "nav.askShort", icon: CircleHelp },
  { href: "/pricing", labelKey: "nav.pricing", icon: CreditCard },
];

export function AppNavigation({ user }: { user: AuthShellUser | null }) {
  const pathname = usePathname();
  const { stats } = useProgressStats();
  const t = useT();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        {t("common.skipToContent")}
      </a>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3 font-semibold text-foreground">
            <Logo size={40} priority />
            <span className="hidden font-display text-xl sm:inline">{APP_NAME}</span>
          </Link>

          <nav aria-label={t("nav.topMenu")} className="hidden items-center gap-0.5 lg:flex">
            {navItems.map((item) => (
              <DesktopNavLink key={item.href} href={item.href} active={pathname === item.href}>
                {t(item.labelKey)}
              </DesktopNavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <RankProgressPopover stats={stats} />
                <AccountMenu user={user} />
                <LocaleSwitcher />
              </>
            ) : (
              <>
                <Link href="/login" className={buttonClassName("ghost", "sm")}>
                  {t("nav.login")}
                </Link>
                <Link href="/register" className={buttonClassName("primary", "sm")}>
                  {t("nav.signup")}
                </Link>
                <LocaleSwitcher />
              </>
            )}
          </div>
        </div>
      </header>

      <nav aria-label={t("nav.mobileMenu")} className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background-card lg:hidden">
        <div className="grid grid-cols-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-foreground-muted transition-colors hover:text-foreground",
                  active && "bg-brand text-brand-foreground hover:text-foreground-inverse",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate px-0.5">{t(item.mobileLabelKey ?? item.labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function DesktopNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-semibold text-foreground-secondary transition-colors hover:bg-background-muted hover:text-foreground",
        active && "bg-background-inverse text-foreground-inverse hover:bg-background-inverse hover:text-foreground-inverse",
      )}
    >
      {children}
    </Link>
  );
}
