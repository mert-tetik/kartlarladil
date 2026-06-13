import type { Metadata } from "next";
import { PricingPage } from "@/features/subscriptions/components/pricing-page";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return {
    title: t("page.pricing.title"),
    description: t("page.pricing.description"),
  };
}

export default async function PricingPageRoute() {
  const user = await getCurrentAuthUser();

  return <PricingPage user={user} />;
}
