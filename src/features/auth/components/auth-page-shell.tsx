import type { ReactNode } from "react";
import Link from "next/link";
import { LibraryBig, ShieldCheck } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export function AuthPageShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
      <aside className="hidden rounded-lg bg-slate-950 p-8 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <Link href="/" className="inline-flex items-center gap-3 font-semibold text-white">
            <span className="flex size-11 items-center justify-center rounded-md bg-white text-slate-950">
              <LibraryBig className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-2xl">{APP_NAME}</span>
          </Link>
          <div className="mt-12 max-w-sm">
            <h1 className="font-display text-4xl font-semibold leading-tight">{title}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">{description}</p>
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/8 p-5">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <ShieldCheck className="size-5 text-emerald-300" aria-hidden="true" />
            Supabase Auth
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Oturum cookie tabanlı SSR akışıyla tutulur. Hesap verileri sadece giriş yapan kullanıcıya açıktır.
          </p>
        </div>
      </aside>

      <div className="flex items-center justify-center lg:pl-10">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
          <div className="lg:hidden">
            <Link href="/" className="inline-flex items-center gap-3 font-semibold text-slate-950">
              <span className="flex size-10 items-center justify-center rounded-md bg-slate-950 text-white">
                <LibraryBig className="size-5" aria-hidden="true" />
              </span>
              <span className="font-display text-xl">{APP_NAME}</span>
            </Link>
            <h1 className="mt-8 font-display text-3xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <div className="hidden lg:block">
            <h2 className="font-display text-3xl font-semibold text-slate-950">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
          </div>
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-600">{footer}</div> : null}
        </div>
      </div>
    </section>
  );
}
