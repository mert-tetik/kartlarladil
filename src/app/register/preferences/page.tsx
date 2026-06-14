import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPageShell } from "@/features/auth/components/auth-page-shell";
import { OnboardingForm } from "@/features/auth/components/onboarding-form";
import { DEFAULT_AUTH_REDIRECT, getSafeNextPath, getSearchParamValue } from "@/features/auth/auth-redirects";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getServerLocale());
  return {
    title: `${t("auth.onboarding.title")} | ${APP_NAME}`,
  };
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = createTranslator(await getServerLocale());
  const params = await searchParams;
  const nextPath = getSafeNextPath(getSearchParamValue(params.next), DEFAULT_AUTH_REDIRECT);
  const user = await getCurrentAuthUser();

  if (!user) {
    const returnPath = `/register/preferences?next=${encodeURIComponent(nextPath)}`;
    redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  }

  return (
    <AuthPageShell title={t("auth.onboarding.title")} description={t("auth.onboarding.description")}>
      <OnboardingForm nextPath={nextPath} />
    </AuthPageShell>
  );
}
