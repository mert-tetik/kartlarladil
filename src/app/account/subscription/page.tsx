import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { buttonClassName } from "@/components/ui/button";
import { SubscriptionSettings } from "@/features/subscriptions/components/subscription-settings";
import { requireAuthUser } from "@/features/auth/auth-session";
import { getUserEntitlements } from "@/features/subscriptions/subscription-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = createTranslator(await getServerLocale());
  return {
    title: `${t("page.accountSubscription.title")} | ${APP_NAME}`,
  };
}

interface WebhookEventRow {
  event_id: string;
  event_name: string;
  payload: Record<string, unknown>;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export default async function AccountSubscriptionPage() {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const user = await requireAuthUser("/account/subscription");
  const entitlements = await getUserEntitlements(user.id);
  const supabase = await createSupabaseServerClient();

  const { data: events } = await supabase
    .from("webhook_events")
    .select("event_id, event_name, payload, processed_at, error_message, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<WebhookEventRow[]>();

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
        <SubscriptionSettings
          plan={entitlements.effectivePlan}
          customerPortalUrl={entitlements.customerPortalUrl}
        />

        <div className="rounded-lg border border-border bg-background-card p-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t("account.subscription.webhookEventsTitle")}
          </h2>

          {events && events.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-foreground-muted">
                    <th className="pb-2 font-medium">{t("account.subscription.eventName")}</th>
                    <th className="pb-2 font-medium">{t("account.subscription.eventTime")}</th>
                    <th className="pb-2 font-medium">{t("account.subscription.processedAt")}</th>
                    <th className="pb-2 font-medium">{t("account.subscription.error")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {events.map((event) => (
                    <tr key={event.event_id}>
                      <td className="py-3 font-medium text-foreground">{event.event_name}</td>
                      <td className="py-3 text-foreground-secondary">{formatDate(event.created_at, locale)}</td>
                      <td className="py-3 text-foreground-secondary">
                        {event.processed_at ? formatDate(event.processed_at, locale) : "-"}
                      </td>
                      <td className="py-3 text-rose-600">{event.error_message ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm text-foreground-muted">{t("account.subscription.noWebhookEvents")}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function formatDate(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
}
