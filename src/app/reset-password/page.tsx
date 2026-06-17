import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("auth.reset.title"),
    description: t("auth.reset.description"),
    pathname: "/reset-password",
    noIndex: true,
  });
}

export default async function ResetPasswordPage() {
  const t = createTranslator(await getServerLocale());

  return (
    <AuthPageShell title={t("auth.reset.title")} description={t("auth.reset.description")}>
      <ResetPasswordForm />
      <div className="mt-6 border-t border-border pt-5 text-sm text-foreground-secondary">
        {t("auth.reset.remembered")}{" "}
        <Link href="/login" className="font-semibold text-foreground">
          {t("auth.login.title")}
        </Link>
      </div>
    </AuthPageShell>
  );
}
