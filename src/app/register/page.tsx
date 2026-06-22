import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";
import { RegisterForm } from "@/features/auth/components/register-form";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath, getSearchParamValue } from "@/features/auth/auth-redirects";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";
export const viewport: Viewport = {
  interactiveWidget: "overlays-content",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("auth.register.title"),
    description: t("auth.register.description"),
    pathname: "/register",
    noIndex: true,
  });
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = createTranslator(await getServerLocale());
  const params = await searchParams;
  const nextPath = getSafeNextPath(getSearchParamValue(params.next), DEFAULT_AUTH_REDIRECT);
  const user = await getCurrentAuthUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <AuthPageShell title={t("auth.register.title")}>
      <GoogleSignInButton nextPath={nextPath} label={t("auth.google.signUp")} />
      <div className="relative flex items-center py-4">
        <div className="grow border-t border-border" />
        <span className="mx-3 text-xs font-medium text-foreground-muted">{t("common.or")}</span>
        <div className="grow border-t border-border" />
      </div>
      <RegisterForm nextPath={nextPath} />
      <div className="mt-6 border-t border-border pt-5 text-sm text-foreground-secondary">
        {t("auth.register.hasAccount")}{" "}
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-foreground">
          {t("auth.login.title")}
        </Link>
      </div>
    </AuthPageShell>
  );
}
