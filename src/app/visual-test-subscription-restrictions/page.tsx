import type { Metadata } from "next";
import { SubscriptionRestrictionTestScreen } from "@/features/subscriptions/components/subscription-restriction-test-screen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subscription restrictions visual test | FoxiesDeck",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SubscriptionRestrictionsVisualTestPage() {
  return <SubscriptionRestrictionTestScreen />;
}
