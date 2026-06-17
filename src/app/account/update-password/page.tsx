import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { UpdatePasswordForm } from "@/features/auth/components/update-password-form";
import { requireAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getServerLocale());
  return {
    title: `${t("auth.updatePassword.title")} | ${APP_NAME}`,
  };
}

export default async function UpdatePasswordPage() {
  const t = createTranslator(await getServerLocale());
  await requireAuthUser("/account/update-password");

  return (
    <AuthPageShell title={t("auth.updatePassword.title")} description={t("auth.updatePassword.description")}>
      <UpdatePasswordForm />
      <div className="mt-6 border-t border-border pt-5 text-sm text-foreground-secondary">
        {t("auth.updatePassword.backToSettings")}{" "}
        <Link href="/account/settings" className="font-semibold text-foreground">
          {t("page.account.title")}
        </Link>
      </div>
    </AuthPageShell>
  );
}
