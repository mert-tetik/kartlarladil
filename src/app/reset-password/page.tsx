import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getServerLocale());
  return {
    title: `${t("auth.reset.title")} | ${APP_NAME}`,
  };
}

export default async function ResetPasswordPage() {
  const t = createTranslator(await getServerLocale());

  return (
    <AuthPageShell title={t("auth.reset.title")} description={t("auth.reset.description")}>
      <ResetPasswordForm />
      <div className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-600">
        {t("auth.reset.remembered")}{" "}
        <Link href="/login" className="font-semibold text-slate-950">
          {t("auth.login.title")}
        </Link>
      </div>
    </AuthPageShell>
  );
}
