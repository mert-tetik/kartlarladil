import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";
import { LoginForm } from "@/features/auth/components/login-form";
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
    title: t("auth.login.title"),
    description: t("auth.login.description"),
    pathname: "/login",
    noIndex: true,
  });
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const params = await searchParams;
  const nextPath = getSafeNextPath(getSearchParamValue(params.next), DEFAULT_AUTH_REDIRECT);
  const message = getSearchParamValue(params.message);
  const user = await getCurrentAuthUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <AuthPageShell title={t("auth.login.title")}>
      <GoogleSignInButton nextPath={nextPath} label={t("auth.google.signIn")} />
      <div className="relative flex items-center py-4">
        <div className="grow border-t border-border" />
        <span className="mx-3 text-xs font-medium text-foreground-muted">{t("common.or")}</span>
        <div className="grow border-t border-border" />
      </div>
      <LoginForm nextPath={nextPath} message={message} />
      <AuthFooter>
        {t("auth.login.noAccount")}{" "}
        <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-foreground">
          {t("auth.register.title")}
        </Link>
      </AuthFooter>
    </AuthPageShell>
  );
}

function AuthFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 border-t border-border pt-5 text-sm text-foreground-secondary">{children}</div>;
}
