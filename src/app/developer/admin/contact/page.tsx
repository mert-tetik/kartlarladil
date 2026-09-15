import type { Metadata } from "next";
import { requireDeveloperAdmin } from "@/features/developer/developer-auth";
import { ContactReviewsPanel } from "@/features/developer/components/contact-reviews-panel";
import { getDeveloperContactReviews } from "@/features/developer/developer-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DeveloperContactAdminPage() {
  await requireDeveloperAdmin("/developer/admin/contact");
  const reviews = await getDeveloperContactReviews();

  return <ContactReviewsPanel initialReviews={reviews} />;
}
