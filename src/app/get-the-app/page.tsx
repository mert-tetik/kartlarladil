import type { Metadata } from "next";
import Image from "next/image";
import { Download } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { getInstallAppCopy } from "@/features/install-app/install-app-copy";
import { randomInt } from "crypto";

export const dynamic = "force-dynamic";

const MASCOT_COUNT = 17;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const copy = getInstallAppCopy(locale);

  return buildMetadata({
    locale,
    title: copy.metaTitle,
    description: copy.metaDescription,
    pathname: "/get-the-app",
  });
}

export default async function GetTheAppPage() {
  const locale = await getServerLocale();
  const copy = getInstallAppCopy(locale);
  const mascotIndex = randomInt(1, MASCOT_COUNT + 1);
  const mascotSrc = `/mascots/mascot${mascotIndex}.png`;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:px-8">
      <div className="relative size-40 sm:size-48">
        <Image
          src={mascotSrc}
          alt="FoxiesDeck mascot"
          fill
          sizes="(max-width: 640px) 160px, 192px"
          className="object-contain"
          priority
        />
      </div>

      <h1 className="mt-8 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {copy.title}
      </h1>

      <p className="mt-4 text-base leading-7 text-foreground-secondary sm:text-lg sm:leading-8">
        {copy.description}
      </p>

      <a
        href="/download/app-release-signed.apk"
        download="foxiesdeck-app-release-signed.apk"
        className={buttonClassName("primary", "lg", "mt-8 h-12 px-8 text-base")}
      >
        <Download className="size-5" aria-hidden="true" />
        {copy.buttonLabel}
      </a>

      <p className="mt-4 text-xs text-foreground-secondary">
        Android cihazlara kurulum için APK dosyasıdır.
      </p>
    </section>
  );
}
