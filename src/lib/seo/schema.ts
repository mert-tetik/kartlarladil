import { APP_NAME, SITE_URL } from "@/lib/constants";

export function createWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: APP_NAME,
    url: SITE_URL,
  };
}

export function createOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: APP_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    contactPoint: {
      "@type": "ContactPoint",
      email: "foxiesdeck@outlook.com",
      contactType: "customer support",
    },
  };
}

export function createSoftwareApplicationSchema({
  description,
  offers,
}: {
  description: string;
  offers?: Array<{ name: string; price: string; priceCurrency: string; availability?: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: APP_NAME,
    description,
    url: SITE_URL,
    applicationCategory: "EducationApplication",
    operatingSystem: "Any",
    offers:
      offers?.map((offer) => ({
        "@type": "Offer",
        ...offer,
      })) ?? [],
  };
}

export function createBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}
