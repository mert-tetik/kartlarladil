import type { Metadata } from "next";
import Image from "next/image";
import { getServerLocale } from "@/i18n/server";
import { createTranslator } from "@/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return buildMetadata({
    locale,
    title: t("install.addToHomeScreen.title"),
    description: t("metadata.description"),
    pathname: "/add-to-home-screen",
  });
}

export default async function AddToHomeScreenPage() {
  const locale = await getServerLocale();
  const t = createTranslator(locale);

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] w-full max-w-md flex-col items-center justify-center px-4 py-8 text-center">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t("install.addToHomeScreen.title")}
      </h1>

      <div className="mt-8 w-full space-y-6 text-left">
        <Step
          number={1}
          text={t("install.addToHomeScreen.step1")}
          image="/install/add-to-home-screen-menu.png"
        />
        <Step
          number={2}
          text={t("install.addToHomeScreen.step2")}
          image="/install/home-screen-icon.png"
        />
        <Step number={3} text={t("install.addToHomeScreen.step3")} />
      </div>

      <p className="mt-8 text-sm text-foreground-secondary">
        {t("install.addToHomeScreen.fallback")}
      </p>
    </section>
  );
}

function Step({
  number,
  text,
  image,
}: {
  number: number;
  text: string;
  image?: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
        {number}
      </span>
      <div className="flex-1">
        <p className="text-base font-medium text-foreground">{text}</p>
        {image ? (
          <div className="relative mt-3 aspect-[3/2] w-full overflow-hidden rounded-lg border border-border bg-background">
            <Image
              src={image}
              alt=""
              fill
              className="object-contain p-1"
              sizes="(max-width: 768px) 100vw, 400px"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
