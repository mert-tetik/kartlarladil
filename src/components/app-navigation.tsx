"use client";

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode, SVGProps } from "react";
import Image from "next/image";
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
import { useSubscription } from "@/features/subscriptions/subscription-client";
import { useLocale, useT } from "@/i18n/locale-provider";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import type { TranslationKey } from "@/i18n/dictionaries";

type NavItem = {
  href: string;
  labelKey: TranslationKey;
  mobileLabelKey?: TranslationKey;
  mobileLabel?: string;
  icon: LucideIcon | ComponentType<SVGProps<SVGSVGElement>>;
  mobileImageSrc?: string;
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
  { href: "/games", labelKey: "nav.games", mobileLabelKey: "nav.gamesShort", icon: Gamepad2, mobileImageSrc: "/mobile-nav-icons/game.png" },
  { href: "/ai-practice", labelKey: "nav.aiPractice", mobileLabelKey: "nav.aiPracticeShort", icon: MessageCircle, mobileImageSrc: "/mobile-nav-icons/practice.png" },
  { href: "/", labelKey: "nav.home", icon: Home, mobileImageSrc: "/mobile-nav-icons/home.png" },
  { href: "/ask", labelKey: "nav.ask", mobileLabelKey: "nav.askShort", icon: CircleHelp, mobileImageSrc: "/mobile-nav-icons/question-mark.png" },
  { href: "/pricing", labelKey: "nav.pricing", mobileLabel: "Premium", icon: Flame, mobileImageSrc: "/mobile-nav-icons/fire.png" },
];

const MOBILE_BREAKPOINT_MEDIA_QUERY = "(max-width: 1023px)";

export function AppNavigation({ user }: { user: AuthShellUser | null }) {
  const pathname = usePathname();
  const { stats } = useProgressStats();
  const { entitlements } = useSubscription();
  const { locale } = useLocale();
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
  const showNavbarBackButton = mobileBackOverride || showMobileBackButton;
  const paidPlan = entitlements?.effectivePlan === "basic" || entitlements?.effectivePlan === "pro"
    ? entitlements.effectivePlan
    : null;

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
        <div className="relative flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            {showNavbarBackButton ? (
              mobileBackOverride ? (
                <button
                  type="button"
                  onClick={() => {
                    vibrate("tap");
                    requestMobileNavbarBack();
                  }}
                  aria-label={t("common.back")}
                  className="flex shrink-0 items-center gap-1 text-sm font-semibold text-white transition-colors hover:text-white/80"
                >
                  <ChevronLeft className="size-6" aria-hidden="true" />
                  <span className="sr-only">{t("common.back")}</span>
                </button>
              ) : (
                <Link
                  href={mobileBackHref}
                  prefetch
                  onClick={() => vibrate("tap")}
                  data-tutorial-target={mobileBackTutorialTarget}
                  className="flex shrink-0 items-center gap-1 text-sm font-semibold text-white transition-colors hover:text-white/80"
                >
                  <ChevronLeft className="size-6" aria-hidden="true" />
                  <span className="sr-only">{t("common.back")}</span>
                </Link>
              )
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
              <Image
                src="/mobile-nav-icons/color-palette.png"
                alt=""
                aria-hidden="true"
                width={128}
                height={128}
                className="size-7 object-contain"
              />
            </button>
          ) : (
            <div className="size-10 shrink-0 lg:hidden" aria-hidden="true" />
          )}

          <Link href="/" prefetch className="hidden shrink-0 items-center gap-3 font-semibold text-white lg:flex">
            <Logo size={40} priority />
            <span className="font-display text-xl">{APP_NAME}</span>
          </Link>
          </div>

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

          <div className="absolute left-1/2 z-10 -translate-x-1/2 lg:hidden">
            <LocaleSwitcher navbar />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <PlanBadge className="hidden h-9 border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white lg:inline-flex" />
              </>
            ) : null}
            <div className="mr-auto hidden lg:order-last lg:mr-0 lg:block">
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
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const shouldPrefetch = PREFETCHED_NAV_PATHS.has(item.href);
              const isPremium = item.href === "/pricing";
              const showPaidPremiumImage = isPremium && paidPlan !== null;
              const label = item.mobileLabel ?? t(item.mobileLabelKey ?? item.labelKey);
              const tutorialTarget = item.href === "/games"
                ? "games-nav"
                : item.href === "/ai-practice"
                  ? "ai-practice-nav"
                  : undefined;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={shouldPrefetch ? true : undefined}
                  aria-current={active ? "page" : undefined}
                  data-games-nav-target={item.href === "/games" ? "" : undefined}
                  data-tutorial-target={tutorialTarget}
                  className={cn(
                    "relative z-0 flex h-full min-h-12 flex-col items-center justify-center gap-0.5 overflow-visible px-0.5 py-1 text-[10px] font-semibold leading-none text-white transition-colors duration-300 hover:text-white",
                    active && "z-10",
                  )}
                >
                  <span
                    className={cn(
                      "relative inline-flex transform-gpu transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      active ? "-translate-y-2 scale-[1.2]" : "translate-y-0 scale-100",
                    )}
                  >
                    {showPaidPremiumImage ? (
                      <Image
                        src={`/subscriptions/plan-${paidPlan}-v2.png`}
                        alt={t(`pricing.${paidPlan}`)}
                        width={1489}
                        height={450}
                        className="h-4 w-10 translate-y-0 -rotate-[10deg] object-contain"
                      />
                    ) : (
                      <MobileNavIcon item={item} className="size-7" />
                    )}
                    {isPremium ? (
                      showPaidPremiumImage ? null : (
                        <span className={cn(
                          "pointer-events-none absolute -right-3 -top-1 rotate-[45deg] bg-gradient-to-r from-[var(--premium-start)] via-[var(--reward-end)] to-[var(--premium-end)] bg-clip-text text-[9px] font-bold text-transparent",
                          canUseSuperWater(locale) && "font-super-water",
                        )}>
                          {formatSuperWaterText(locale, "FREE")}
                        </span>
                      )
                    ) : null}
                  </span>
                  {showPaidPremiumImage ? null : (
                    <span className={cn(
                      "max-w-full truncate px-0.5 text-white",
                      canUseSuperWater(locale) && "font-super-water",
                    )}>
                      {formatSuperWaterText(locale, label)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </>
  );
}

function MobileNavIcon({ item, className }: { item: NavItem; className: string }) {
  if (item.mobileImageSrc) {
    return (
      <Image
        src={item.mobileImageSrc}
        alt=""
        aria-hidden="true"
        width={128}
        height={128}
        className={cn(className, "object-contain")}
      />
    );
  }

  const Icon = item.icon;
  return <Icon className={className} strokeWidth={2} aria-hidden="true" />;
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
