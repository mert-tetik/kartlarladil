import type { Metadata } from "next";
import { headers } from "next/headers";
import { PricingPage } from "@/features/subscriptions/components/pricing-page";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { getCurrencyCodeForCountry } from "@/lib/country-currency";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return buildMetadata({
    locale,
    title: t("page.pricing.title"),
    description: t("page.pricing.description"),
    pathname: "/pricing",
  });
}

export default async function PricingPageRoute() {
  const [user, requestHeaders] = await Promise.all([
    getCurrentAuthUser(),
    headers(),
  ]);
  const currencyCode = getCurrencyCodeForCountry(
    requestHeaders.get("x-vercel-ip-country"),
  );

  return <PricingPage user={user} currencyCode={currencyCode} />;
}
