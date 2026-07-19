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
  Flame,
  Gamepad2,
  Home,
  MessageCircle,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { CardsIcon } from "@/components/icons/cards-icon";
import { CardDecksIcon } from "@/components/icons/card-decks-icon";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonClassName } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import {
  requestMobileNavbarBack,
  subscribeMobileNavbarBackOverride,
} from "@/components/mobile-navbar-back";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { ThemePickerDialog } from "@/features/auth/components/theme-picker-dialog";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { RankProgressPopover } from "@/features/progress/components/rank-progress-popover";
import { useProgressStats } from "@/features/progress/progress-client";
import { PlanBadge } from "@/features/subscriptions/components/plan-badge";
import { useT } from "@/i18n/locale-provider";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import type { TranslationKey } from "@/i18n/dictionaries";

type NavItem = {
  href: string;
  labelKey: TranslationKey;
  mobileLabelKey?: TranslationKey;
  mobileLabel?: string;
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
};

const PREFETCHED_NAV_PATHS = new Set([
  "/",
  "/card-draw",
  "/my-cards",
  "/learn",
  "/games",
  "/ai-practice",
  "/ask",
]);

const navItems: readonly NavItem[] = [
  { href: "/card-draw", labelKey: "nav.cardDraw", icon: CardsIcon },
  { href: "/my-cards", labelKey: "nav.inventory", icon: CardDecksIcon },
  { href: "/learn", labelKey: "nav.learn", icon: BookOpen },
  { href: "/games", labelKey: "nav.games", mobileLabelKey: "nav.gamesShort", icon: Gamepad2 },
  { href: "/ai-practice", labelKey: "nav.aiPractice", mobileLabelKey: "nav.aiPracticeShort", icon: MessageCircle },
  { href: "/ask", labelKey: "nav.ask", mobileLabelKey: "nav.askShort", icon: CircleHelp },
  { href: "/pricing", labelKey: "nav.pricing", icon: CreditCard },
];

const mobileNavItems: readonly NavItem[] = [
  { href: "/games", labelKey: "nav.games", mobileLabelKey: "nav.gamesShort", icon: Gamepad2 },
  { href: "/ai-practice", labelKey: "nav.aiPractice", mobileLabelKey: "nav.aiPracticeShort", icon: MessageCircle },
  { href: "/", labelKey: "nav.home", icon: Home },
  { href: "/ask", labelKey: "nav.ask", mobileLabelKey: "nav.askShort", icon: CircleHelp },
  { href: "/pricing", labelKey: "nav.pricing", mobileLabel: "Premium", icon: Flame },
];

const MOBILE_BREAKPOINT_MEDIA_QUERY = "(max-width: 1023px)";

export function AppNavigation({ user }: { user: AuthShellUser | null }) {
  const pathname = usePathname();
  const { stats } = useProgressStats();
  const t = useT();
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileBackOverride, setMobileBackOverride] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const showMobileBackButton =
    isMobileViewport &&
    (mobileBackOverride ||
      pathname === "/card-draw" ||
      pathname === "/leaderboard" ||
      pathname === "/learn" ||
      pathname === "/pricing" ||
      pathname.startsWith("/ai-practice/") ||
      pathname === "/create-card" ||
      pathname === "/games" ||
      pathname.startsWith("/games/"));

  const mobileBackHref = (() => {
    if (mobileBackOverride) return "/";
    if (pathname === "/games") return "/";
    if (pathname.startsWith("/games/")) return "/games";
    if (pathname === "/leaderboard") return "/";

    if (pathname.startsWith("/ai-practice/")) {
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length >= 3) {
        if (segments[2] === "character") {
          return "/ai-practice";
        }
        return `/ai-practice/${segments[1]}`;
      }
      if (segments.length === 2) {
        return `/ai-practice/${segments[1]}/character`;
      }
    }

    return "/";
  })();
  const mobileBackTutorialTarget =
    pathname === "/card-draw"
      ? "card-draw-navbar-back"
      : pathname === "/create-card"
        ? "create-card-navbar-back"
        : pathname === "/leaderboard"
          ? "leaderboard-navbar-back"
          : undefined;

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

  useEffect(() => subscribeMobileNavbarBackOverride(setMobileBackOverride), []);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background"
      >
        {t("common.skipToContent")}
      </a>
      <header
        data-route-transition-navigation
        className="sticky top-0 z-50 border-b border-white/10 bg-black text-white"
      >
        <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          {showMobileBackButton ? (
            <Link
              href={mobileBackHref}
              prefetch
              onClick={() => {
                vibrate("tap");
                if (mobileBackOverride) {
                  requestMobileNavbarBack();
                }
              }}
              data-tutorial-target={mobileBackTutorialTarget}
              className="flex shrink-0 items-center gap-1 text-sm font-semibold text-white transition-colors hover:text-white/80"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
              <span className="sr-only">{t("common.back")}</span>
            </Link>
          ) : user ? (
            <button
              type="button"
              onClick={() => {
                vibrate("tap");
                setThemeOpen(true);
              }}
              aria-label={t("theme.title")}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-white transition-colors hover:bg-white/10 lg:hidden"
            >
              <Palette className="size-5" aria-hidden="true" />
            </button>
          ) : (
            <div className="size-10 shrink-0 lg:hidden" aria-hidden="true" />
          )}

          <Link href="/" prefetch className="hidden shrink-0 items-center gap-3 font-semibold text-white lg:flex">
            <Logo size={40} priority />
            <span className="font-display text-xl">{APP_NAME}</span>
          </Link>

          <nav aria-label={t("nav.topMenu")} className="hidden items-center gap-0.5 lg:flex">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const shouldPrefetch = PREFETCHED_NAV_PATHS.has(item.href);
              return (
                <DesktopNavLink key={item.href} href={item.href} active={active} prefetch={shouldPrefetch ? true : undefined}>
                  {t(item.labelKey)}
                </DesktopNavLink>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <Link href="/pricing" className="inline-flex lg:hidden" aria-label={t("page.pricing.title")}>
                  <PlanBadge variant="mobile-game" />
                </Link>
                <PlanBadge className="hidden h-9 border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white lg:inline-flex" />
              </>
            ) : null}
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
                  className={cn(
                    buttonClassName("ghost", "sm", "text-white hover:bg-white/10 hover:text-white"),
                    "max-lg:hidden",
                  )}
                >
                  {t("nav.login")}
                </Link>
                <Link
                  href="/register"
                  className={cn(buttonClassName("primary", "sm"), "max-lg:hidden")}
                >
                  {t("nav.signup")}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {user ? <ThemePickerDialog open={themeOpen} onOpenChange={setThemeOpen} /> : null}

      <div
        data-mobile-main-nav-frame
        className="mobile-main-nav-frame text-foreground lg:hidden"
      >
        <nav
          aria-label={t("nav.mobileMenu")}
          data-mobile-main-nav
          className="mobile-main-nav-bar bg-background-card dark:bg-[#090909]"
        >
          <div className="grid h-full grid-cols-5 items-center">
            {mobileNavItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const shouldPrefetch = PREFETCHED_NAV_PATHS.has(item.href);
              const isHome = item.href === "/";
              const isPremium = item.href === "/pricing";

              if (isHome) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={shouldPrefetch ? true : undefined}
                    aria-current={active ? "page" : undefined}
                    className="flex h-full items-center justify-center"
                  >
                    <span className="relative -top-4 inline-flex size-14 items-center justify-center rounded-full bg-brand text-background shadow-lg transition-transform hover:scale-105 active:scale-95">
                      <Icon className="size-5" strokeWidth={2.5} aria-hidden="true" />
                    </span>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={shouldPrefetch ? true : undefined}
                  aria-current={active ? "page" : undefined}
                  data-games-nav-target={item.href === "/games" ? "" : undefined}
                  data-tutorial-target={item.href === "/games" ? "games-nav" : undefined}
                  className={cn(
                    "relative flex h-full min-h-12 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10px] font-semibold leading-none text-foreground-muted transition-colors hover:text-foreground",
                    active && "text-brand",
                  )}
                >
                  <span className="relative inline-flex">
                    <Icon className="size-[18px]" strokeWidth={active ? 2.25 : 2} aria-hidden="true" />
                    {isPremium ? (
                      <span className="pointer-events-none absolute -right-3 -top-1 rotate-[45deg] bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500 bg-clip-text text-[9px] font-bold text-transparent">
                        FREE
                      </span>
                    ) : null}
                  </span>
                  <span className="max-w-full truncate px-0.5">{item.mobileLabel ?? t(item.mobileLabelKey ?? item.labelKey)}</span>
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
  prefetch,
  children,
}: {
  href: string;
  active: boolean;
  prefetch?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white",
        active && "bg-white text-black hover:bg-white hover:text-black",
      )}
    >
      {children}
    </Link>
  );
}
