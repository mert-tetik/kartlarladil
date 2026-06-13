import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { LoginForm } from "@/features/auth/components/login-form";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath, getSearchParamValue } from "@/features/auth/auth-redirects";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getServerLocale());
  return {
    title: `${t("auth.login.title")} | ${APP_NAME}`,
  };
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
    <AuthPageShell title={t("auth.login.title")} description={t("auth.login.description")} logoVariant="inverted">
      <LoginForm nextPath={nextPath} message={message} />
      <AuthFooter>
        {t("auth.login.noAccount")}{" "}
        <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-slate-950">
          {t("auth.register.title")}
        </Link>
      </AuthFooter>
    </AuthPageShell>
  );
}

function AuthFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 border-t border-slate-200 pt-5 text-sm text-slate-600">{children}</div>;
}
