import "server-only";

import { sendAutomationPushNotification } from "@/features/push/push-server";
import type { WebPushSubscriptionJson } from "@/features/push/push-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function notifyAutomationRunTerminal(ownerKey: string, status: "completed" | "completed_with_errors") {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("social_content_automation_push_subscriptions").select("id,subscription").eq("owner_key", ownerKey).eq("active", true);
  if (error || !data?.length) return { sent: 0, failed: 0 };
  const succeeded = status === "completed";
  let sent = 0;
  let failed = 0;
  await Promise.all(data.map(async (item) => {
    try {
      await sendAutomationPushNotification(item.subscription as WebPushSubscriptionJson, {
        title: succeeded ? "FoxiesDeck batch hazır" : "FoxiesDeck batch kontrol bekliyor",
        body: succeeded ? "Tüm içerikler kalite kontrolünden geçti ve schedule edildi." : "Bazı içerikler tamamlanamadı; sonuç ekranında kontrol et.",
        targetUrl: `${process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/u, "") ?? ""}/content-automation/automations`,
        tag: `foxiesdeck-automation-${status}`,
      });
      sent += 1;
      await supabase.from("social_content_automation_push_subscriptions").update({ last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", item.id);
    } catch (error) {
      failed += 1;
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : null;
      if (statusCode === 404 || statusCode === 410) await supabase.from("social_content_automation_push_subscriptions").update({ active: false, updated_at: new Date().toISOString() }).eq("id", item.id);
    }
  }));
  return { sent, failed };
}
