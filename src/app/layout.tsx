import type { Metadata, Viewport } from "next";
import { LemonSqueezyScript } from "@/components/lemonsqueezy-script";
import { TutorialPointer } from "@/features/tutorial/tutorial-pointer";
import { Fraunces, Manrope } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { DEFAULT_THEME_ID } from "@/lib/themes";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale, getServerTextDirection } from "@/i18n/server";
import { APP_NAME } from "@/lib/constants";
import { buildMetadata } from "@/lib/seo/metadata";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-visual",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return buildMetadata({
    locale,
    title: APP_NAME,
    description: t("metadata.description"),
  });
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getServerLocale();
  const direction = await getServerTextDirection();
  const user = await getCurrentAuthUser();
  const themeId = user?.profile.theme ?? DEFAULT_THEME_ID;

  return (
    <html lang={locale} dir={direction} className={`${manrope.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full" data-theme={themeId}>
        <AppShell locale={locale} user={user}>{children}</AppShell>
        <LemonSqueezyScript />
        <TutorialPointer />
      </body>
    </html>
  );
}
