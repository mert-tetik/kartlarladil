import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonClassName } from "@/components/ui/button";
import { AccountSettingsForm } from "@/features/auth/components/account-settings-form";
import { DeleteAccountForm } from "@/features/auth/components/delete-account-form";
import { requireAuthUser } from "@/features/auth/auth-session";
import { NotificationSettingsCard } from "@/features/push/components/notification-settings-card";
import { SubscriptionSettings } from "@/features/subscriptions/components/subscription-settings";
import { getUserEntitlementsOrNull } from "@/features/subscriptions/subscription-service";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  return buildMetadata({
    locale,
    title: t("page.account.title"),
    description: t("page.account.description"),
    pathname: "/account/settings",
    noIndex: true,
  });
}

export default async function AccountSettingsPage() {
  const t = createTranslator(await getServerLocale());
  const user = await requireAuthUser("/account/settings");
  const entitlements = await getUserEntitlementsOrNull(user.id);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        title={t("page.account.title")}
        description={t("page.account.description")}
        action={
          <Link href="/account/update-password" className={buttonClassName("secondary", "sm")}>
            {t("auth.updatePassword.title")}
          </Link>
        }
      />

      <div className="mt-8 grid gap-6">
        <AccountSettingsForm user={user} />
        <NotificationSettingsCard />
        {entitlements ? (
          <>
            <SubscriptionSettings plan={entitlements.effectivePlan} />
            <DeleteAccountForm
              email={user.email}
              hasActiveSubscription={entitlements.effectivePlan !== "free"}
            />
          </>
        ) : (
          <p
            role="alert"
            className="rounded-lg border border-border bg-background-card px-4 py-3 text-sm text-foreground"
          >
            {t("pricing.error.loadFailed")}
          </p>
        )}
      </div>
    </section>
  );
}
