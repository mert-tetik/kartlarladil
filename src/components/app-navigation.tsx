"use client";

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  CircleHelp,
  CreditCard,
  Home,
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

const mobileNavItems: readonly NavItem[] = [
  { href: "/", labelKey: "nav.home", icon: Home },
  { href: "/ai-practice", labelKey: "nav.aiPractice", mobileLabelKey: "nav.aiPracticeShort", icon: MessageCircle },
  { href: "/ask", labelKey: "nav.ask", mobileLabelKey: "nav.askShort", icon: CircleHelp },
  { href: "/pricing", labelKey: "nav.pricing", icon: CreditCard },
];

const MOBILE_BREAKPOINT_MEDIA_QUERY = "(max-width: 1023px)";

export function AppNavigation({ user }: { user: AuthShellUser | null }) {
  const pathname = usePathname();
  const { stats } = useProgressStats();
  const t = useT();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const showMobileBackButton =
    isMobileViewport &&
    (pathname === "/card-draw" || pathname === "/learn" || pathname.startsWith("/ai-practice/"));

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_MEDIA_QUERY);
    const syncViewport = () => setIsMobileViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        {t("common.skipToContent")}
      </a>
      <header
        className="sticky top-0 z-40 border-b border-white/10 bg-black text-white"
      >
        <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {showMobileBackButton ? (
            <Link
              href="/"
              className="flex shrink-0 items-center gap-1 text-sm font-semibold text-white transition-colors hover:text-white/80"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
              <span className="sr-only">{t("common.back")}</span>
            </Link>
          ) : (
            <Link href="/" className="flex shrink-0 items-center gap-3 font-semibold text-white">
              <Logo size={40} priority />
              <span className="hidden font-display text-xl sm:inline">{APP_NAME}</span>
            </Link>
          )}

          <nav aria-label={t("nav.topMenu")} className="hidden items-center gap-0.5 lg:flex">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <DesktopNavLink key={item.href} href={item.href} active={active}>
                  {t(item.labelKey)}
                </DesktopNavLink>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="mr-auto lg:order-last lg:mr-0">
              <LocaleSwitcher navbar />
            </div>
            {user ? (
              <>
                <div className="max-lg:hidden">
                  <RankProgressPopover stats={stats} userId={user.id} navbar />
                </div>
                <AccountMenu user={user} navbar />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={buttonClassName("ghost", "sm", "text-white hover:bg-white/10 hover:text-white")}
                >
                  {t("nav.login")}
                </Link>
                <Link href="/register" className={buttonClassName("primary", "sm")}>
                  {t("nav.signup")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div
        data-mobile-main-nav-frame
        className="mobile-main-nav-frame text-foreground lg:hidden"
      >
        <nav
          aria-label={t("nav.mobileMenu")}
          data-mobile-main-nav
          className="mobile-main-nav-bar border-t border-border bg-background-card"
        >
          <div className="grid h-full grid-cols-4">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full min-h-12 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10px] font-semibold leading-none text-foreground-muted transition-colors hover:bg-background-muted hover:text-foreground",
                    active && "bg-background-muted text-brand hover:text-brand",
                  )}
                >
                  {active ? (
                    <span className="absolute inset-x-3 top-0 h-0.5 bg-brand" aria-hidden="true" />
                  ) : null}
                  <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
                  <span className="max-w-full truncate px-0.5">{t(item.mobileLabelKey ?? item.labelKey)}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
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
        "rounded-md px-3 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white",
        active && "bg-white text-black hover:bg-white hover:text-black",
      )}
    >
      {children}
    </Link>
  );
}
