import type { Metadata } from "next";
import { APP_NAME, SITE_URL } from "@/lib/constants";
import type { LocaleCode } from "@/types/domain";

export const DEFAULT_TITLE_TEMPLATE = `%s | ${APP_NAME}`;

interface BuildMetadataOptions {
  locale: LocaleCode;
  title?: string;
  description?: string;
  pathname?: string;
  noIndex?: boolean;
  image?: string;
}

export function buildMetadata({
  locale,
  title,
  description,
  pathname,
  noIndex = false,
  image = "/opengraph-image.png",
}: BuildMetadataOptions): Metadata {
  const pageTitle = title ?? APP_NAME;
  const pageUrl = pathname ? `${SITE_URL}${pathname}` : SITE_URL;
  const ogImage = image.startsWith("http") ? image : `${SITE_URL}${image}`;

  return {
    metadataBase: new URL(SITE_URL),
    title: title ? { default: title, template: DEFAULT_TITLE_TEMPLATE } : APP_NAME,
    description,
    applicationName: APP_NAME,
    openGraph: {
      type: "website",
      locale,
      siteName: APP_NAME,
      title: pageTitle,
      description,
      url: pageUrl,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
      images: [ogImage],
    },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    alternates: {
      canonical: pageUrl,
    },
  };
}
