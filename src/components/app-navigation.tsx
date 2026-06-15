"use client";

import type { ComponentType, ReactNode, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Boxes,
  CreditCard,
  Home,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import { CardsIcon } from "@/components/icons/cards-icon";
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
  { href: "/", labelKey: "nav.home", icon: Home },
  { href: "/card-draw", labelKey: "nav.cardDraw", icon: CardsIcon },
  { href: "/my-cards", labelKey: "nav.inventory", icon: Boxes },
  { href: "/learn", labelKey: "nav.learn", icon: BookOpen },
  { href: "/ai-practice", labelKey: "nav.aiPractice", mobileLabelKey: "nav.aiPracticeShort", icon: MessageCircle },
  { href: "/pricing", labelKey: "nav.pricing", icon: CreditCard },
];

export function AppNavigation({ user }: { user: AuthShellUser | null }) {
  const pathname = usePathname();
  const { stats } = useProgressStats();
  const t = useT();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3 font-semibold text-slate-950">
            <Logo size={40} priority />
            <span className="hidden font-display text-xl sm:inline">{APP_NAME}</span>
          </Link>

          <nav aria-label={t("nav.topMenu")} className="hidden items-center gap-1 lg:flex">
            {navItems
              .filter((item) => item.href !== "/pricing")
              .slice(1)
              .map((item) => (
                <DesktopNavLink key={item.href} href={item.href} active={pathname === item.href}>
                  {t(item.labelKey)}
                </DesktopNavLink>
              ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/pricing"
              className={cn(
                buttonClassName("primary", "sm"),
                "hidden bg-[#f76808] text-white hover:bg-[#e05d00] focus-visible:outline-[#f76808] lg:inline-flex",
              )}
            >
              {t("nav.pricing")}
            </Link>
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

      <nav aria-label={t("nav.mobileMenu")} className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white lg:hidden">
        <div className="grid grid-cols-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-950",
                  active && "bg-[#f76808] text-white hover:text-white",
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
        "rounded-md px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950",
        active && "bg-slate-950 text-white hover:bg-slate-950 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
