import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { APP_NAME } from "@/lib/constants";

export async function AuthPageShell({
  title,
  description,
  children,
  hideBranding = false,
  hideHeader = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  hideBranding?: boolean;
  hideHeader?: boolean;
}) {
  const t = createTranslator(await getServerLocale());

  return (
    <section className="mx-auto grid min-h-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-10">
      <aside className="hidden rounded-lg bg-background-inverse p-8 text-foreground-inverse lg:flex lg:flex-col lg:justify-between">
        <div>
          {!hideBranding ? (
            <Link href="/" className="inline-flex items-center gap-3 font-semibold text-foreground-inverse">
              <Logo size={44} priority />
              <span className="font-display text-2xl">{APP_NAME}</span>
            </Link>
          ) : null}
          {!hideHeader ? (
            <div className={hideBranding ? "max-w-sm" : "mt-12 max-w-sm"}>
              <h1 className="font-display text-4xl font-semibold leading-tight">{title}</h1>
              {description ? <p className="mt-4 text-sm leading-7 text-foreground-muted">{description}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-foreground-inverse/10 bg-background-card/8 p-5">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <ShieldCheck className="size-5 text-emerald-300" aria-hidden="true" />
            {t("auth.supabase.title")}
          </div>
          <p className="mt-3 text-sm leading-6 text-foreground-muted">{t("auth.supabase.description")}</p>
        </div>
      </aside>

      <div className="flex items-start justify-center lg:items-center lg:pl-10">
        <div className="w-full max-w-md rounded-lg border border-border bg-background-card p-6 sm:p-8">
          {!hideBranding || !hideHeader ? (
            <>
              <div className="lg:hidden">
                {!hideBranding ? (
                  <Link href="/" className="inline-flex items-center gap-3 font-semibold text-foreground">
                    <Logo size={40} priority />
                    <span className="font-display text-xl">{APP_NAME}</span>
                  </Link>
                ) : null}
                {!hideHeader ? (
                  <>
                    <h1 className={hideBranding ? "font-display text-3xl font-semibold text-foreground" : "mt-8 font-display text-3xl font-semibold text-foreground"}>
                      {title}
                    </h1>
                    {description ? <p className="mt-3 text-sm leading-6 text-foreground-secondary">{description}</p> : null}
                  </>
                ) : null}
              </div>
              {!hideHeader ? (
                <div className="hidden lg:block">
                  <h2 className="font-display text-3xl font-semibold text-foreground">{title}</h2>
                  {description ? <p className="mt-3 text-sm leading-6 text-foreground-secondary">{description}</p> : null}
                </div>
              ) : null}
            </>
          ) : null}
          <div className={hideBranding && hideHeader ? "" : "mt-7"}>{children}</div>
        </div>
      </div>
    </section>
  );
}
