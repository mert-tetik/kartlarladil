"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Boxes, Compass, GraduationCap, LibraryBig, Sparkles, Trophy } from "lucide-react";
import { AccountMenu } from "@/features/auth/components/account-menu";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { useProgressStats } from "@/features/progress/progress-client";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { buttonClassName } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Ana sayfa", icon: Sparkles },
  { href: "/kesfet", label: "Keşfet", icon: Compass },
  { href: "/kartlarim", label: "Kartlarım", icon: Boxes },
  { href: "/ogren", label: "Öğren", icon: BookOpen },
  { href: "/ogrenilenler", label: "Öğrenilenler", icon: GraduationCap },
];

export function AppNavigation({ user }: { user: AuthShellUser | null }) {
  const pathname = usePathname();
  const { stats } = useProgressStats();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/88 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3 font-semibold text-slate-950">
            <span className="flex size-10 items-center justify-center rounded-md bg-slate-950 text-white">
              <LibraryBig className="size-5" aria-hidden="true" />
            </span>
            <span className="hidden font-display text-xl sm:inline">{APP_NAME}</span>
          </Link>

          <nav aria-label="Üst menü" className="hidden items-center gap-1 lg:flex">
            {navItems.slice(1).map((item) => (
              <DesktopNavLink key={item.href} href={item.href} active={pathname === item.href}>
                {item.label}
              </DesktopNavLink>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/kesfet" className={buttonClassName("secondary", "sm", "hidden md:inline-flex")}>
              Kart çek
            </Link>
            {user ? (
              <>
                <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 sm:flex">
                  <Trophy className="size-4 text-amber-500" aria-hidden="true" />
                  <span>{stats.rank.label}</span>
                  <span className="text-slate-400">/</span>
                  <span>{stats.totalPoints} puan</span>
                </div>
                <AccountMenu user={user} />
              </>
            ) : (
              <>
                <Link href="/login" className={buttonClassName("ghost", "sm")}>
                  Giriş yap
                </Link>
                <Link href="/register" className={buttonClassName("primary", "sm")}>
                  Kayıt ol
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <nav aria-label="Mobil ana menü" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white lg:hidden">
        <div className="grid grid-cols-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-950",
                  active && "text-slate-950",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{item.label}</span>
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
