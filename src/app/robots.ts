import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/terms", "/privacy", "/cookies", "/refund", "/subscriptions", "/card-draw"],
        disallow: [
          "/login",
          "/register",
          "/register/",
          "/reset-password",
          "/account",
          "/profile",
          "/learn",
          "/learned",
          "/my-cards",
          "/ai-practice",
          "/ask",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
