import Link from "next/link";
import { Logo } from "@/components/logo";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { cn } from "@/lib/utils";

export async function SiteFooter({ className }: { className?: string }) {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const year = new Date().getFullYear();

  const legalLinks = [
    { href: "/terms", label: t("footer.terms") },
    { href: "/privacy", label: t("footer.privacy") },
    { href: "/refund", label: t("footer.refund") },
    { href: "/cookies", label: t("footer.cookies") },
    { href: "/subscriptions", label: t("footer.subscriptions") },
  ];

  return (
    <footer className={cn("border-t border-border bg-background-card", className)}>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <span className="font-display text-lg font-semibold text-foreground">FoxiesDeck</span>
          </div>
          <nav aria-label={t("footer.legal")} className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-foreground-secondary">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-8 text-sm text-foreground-muted md:flex-row md:justify-between">
          <p>{t("footer.copyright", { year })}</p>
          <a
            href={`mailto:${t("legal.contactEmail")}`}
            className="transition-colors hover:text-foreground"
          >
            {t("legal.contactEmail")}
          </a>
        </div>
      </div>
    </footer>
  );
}
