import type { Metadata } from "next";
import Image from "next/image";
import { Ellipsis, Plus, SquareArrowUp } from "lucide-react";
import { getServerLocale } from "@/i18n/server";
import { createTranslator } from "@/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

const APPLE_WEB_APP_GUIDE_URL =
  "https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iphea86e5236/ios";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return buildMetadata({
    locale,
    title: t("install.addToHomeScreen.guideTitle"),
    description: t("install.addToHomeScreen.guideIntro"),
    pathname: "/add-to-home-screen",
  });
}

export default async function AddToHomeScreenPage() {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return (
    <section className="min-h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] bg-background px-5 py-6 sm:px-10 sm:py-7">
      <article className="w-full max-w-6xl text-left">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.45rem]">
          {t("install.addToHomeScreen.guideTitle")}
        </h1>
        <p className="mt-3 max-w-5xl text-lg leading-relaxed text-foreground-secondary sm:text-[1.3rem]">
          {t("install.addToHomeScreen.guideIntro")}
        </p>

        <ol className="mt-5 list-decimal space-y-4 pl-7 text-lg leading-[1.45] text-foreground sm:text-[1.25rem]">
          <li className="pl-1">
            {locale === "en" ? "Tap " : null}
            <InlineMoreIcon /> {t("install.addToHomeScreen.guideStep3")}
            <p className="ml-6 mt-4">
              {t("install.addToHomeScreen.guideTabsLayoutBefore")} <InlineShareIcon /> {t("install.addToHomeScreen.guideTabsLayoutAfter")}
            </p>
          </li>
          <li className="pl-1">
            {t("install.addToHomeScreen.guideStep4")}
            <p className="ml-6 mt-4">
              {t("install.addToHomeScreen.guideFallbackBefore")} <InlineAddIcon /> {t("install.addToHomeScreen.guideFallbackAfter")}
            </p>
            <p className="ml-6 mt-4">
              {t("install.addToHomeScreen.guideWebAppPrefix")} {" "}
              <a
                href={APPLE_WEB_APP_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand underline-offset-2 hover:text-brand-hover hover:underline"
              >
                {t("install.addToHomeScreen.guideWebAppLink")}
              </a>{" "}
              {t("install.addToHomeScreen.guideWebAppSuffix")}
            </p>
          </li>
          <li className="pl-1">{t("install.addToHomeScreen.guideStep5")}</li>
        </ol>

        <p className="mt-5 text-lg leading-relaxed text-foreground-secondary sm:text-[1.25rem]">
          {t("install.addToHomeScreen.guideFooter")}
        </p>

        <Image
          src="/install/instruction.png"
          alt={t("install.addToHomeScreen.guideImageAlt")}
          width={432}
          height={656}
          className="mx-auto mt-8 h-auto w-full max-w-[432px]"
        />
      </article>
    </section>
  );
}

function InlineMoreIcon() {
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-background-muted align-[-0.18em]" aria-hidden="true">
      <Ellipsis className="size-3.5 text-foreground-secondary" strokeWidth={3} />
    </span>
  );
}

function InlineShareIcon() {
  return <SquareArrowUp className="inline-block size-5 align-[-0.2em] text-brand" aria-hidden="true" />;
}

function InlineAddIcon() {
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand align-[-0.18em] text-brand-foreground" aria-hidden="true">
      <Plus className="size-3.5" strokeWidth={3} />
    </span>
  );
}
