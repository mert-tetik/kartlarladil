import type { Metadata } from "next";
import { ReviewSection } from "@/features/reviews/components/review-section";
import { requireAuthUser } from "@/features/auth/auth-session";
import { getExistingReview } from "@/features/reviews/review-service";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return buildMetadata({
    locale,
    title: t("footer.contact"),
    description: t("home.review.description"),
    pathname: "/contact",
    noIndex: true,
  });
}

export default async function ContactPage() {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const user = await requireAuthUser("/contact");
  const existingReview = await getExistingReview(user.id);

  return (
    <ReviewSection
      variant="mobile"
      user={user}
      existingReview={existingReview}
      t={{
        title: t("footer.contact"),
        description: t("home.review.description"),
        ratingLabel: t("home.review.ratingLabel"),
        commentLabel: t("home.review.commentLabel"),
        commentPlaceholder: t("home.review.commentPlaceholder"),
        submit: t("home.review.submit"),
        loginRequired: t("home.review.loginRequired"),
        login: t("home.review.login"),
        success: t("home.review.success"),
        error: t("home.review.error"),
        invalidRating: t("home.review.invalidRating"),
        back: t("common.back"),
      }}
    />
  );
}
