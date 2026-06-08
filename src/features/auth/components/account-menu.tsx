"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Settings, Shield, UserRound } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
import { getAccountInitial, getAccountLabel } from "@/features/auth/account-display";
import type { AuthShellUser } from "@/features/auth/auth-types";
import { cn } from "@/lib/utils";

export function AccountMenu({ user }: { user: AuthShellUser }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const initial = getAccountInitial(user);

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
        aria-label="Hesap menüsü"
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
          <div className="h-px bg-slate-200" />
          <MenuLink href="/account/settings" icon={Settings} label="Hesap ayarları" />
          <MenuLink href="/account/update-password" icon={Shield} label="Şifreyi güncelle" />
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Çıkış yap
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
