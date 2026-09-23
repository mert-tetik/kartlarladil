import type { Metadata } from "next";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { createTranslator } from "@/i18n/dictionaries";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { TWA_PLAY_STORE_URL } from "@/features/install-app/twa-mode";
import { randomInt } from "crypto";

export const dynamic = "force-dynamic";

const MASCOT_COUNT = 17;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return buildMetadata({
    locale,
    title: t("install.playStore.title"),
    description: t("install.playStore.description"),
    pathname: "/get-the-app",
  });
}

export default async function GetTheAppPage() {
  const locale = await getServerLocale();
  const t = createTranslator(locale);
  const mascotIndex = randomInt(1, MASCOT_COUNT + 1);
  const mascotSrc = `/mascots/mascot${mascotIndex}.webp`;

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
        {t("install.playStore.title")}
      </h1>

      <p className="mt-4 text-base leading-7 text-foreground-secondary sm:text-lg sm:leading-8">
        {t("install.playStore.description")}
      </p>

      <a
        href={TWA_PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClassName("primary", "lg", "mt-8 h-12 px-8 text-base")}
      >
        <ExternalLink className="size-5" aria-hidden="true" />
        {t("home.mobile.getFromPlayStore")}
      </a>

      <p className="mt-4 text-xs text-foreground-secondary">
        {t("install.playStore.note")}
      </p>
    </section>
  );
}
