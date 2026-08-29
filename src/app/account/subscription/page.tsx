import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonClassName } from "@/components/ui/button";
import { SubscriptionSettings } from "@/features/subscriptions/components/subscription-settings";
import { requireAuthUser } from "@/features/auth/auth-session";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("page.accountSubscription.title"),
    description: t("page.accountSubscription.description"),
    pathname: "/account/subscription",
    noIndex: true,
  });
}

export default async function AccountSubscriptionPage() {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const user = await requireAuthUser("/account/subscription");
  const entitlements = await getUserEntitlements(user.id);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title={t("page.accountSubscription.title")}
        description={t("page.accountSubscription.description")}
        action={
          <Link href="/account/settings" className={buttonClassName("secondary", "sm")}>
            {t("common.back")}
          </Link>
        }
      />

      <div className="mt-8 grid gap-6">
        <SubscriptionSettings plan={entitlements.effectivePlan} />
      </div>
    </section>
  );
}
