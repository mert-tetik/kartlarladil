import type { Metadata } from "next";
import { PricingPage } from "@/features/subscriptions/components/pricing-page";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
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
  const user = await getCurrentAuthUser();

  return <PricingPage user={user} />;
}
