import type { Metadata } from "next";
import Image from "next/image";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { getServerLocale } from "@/i18n/server";
import { buildMetadata } from "@/lib/seo/metadata";
import { getInstallAppCopy } from "@/features/install-app/install-app-copy";

export const dynamic = "force-dynamic";

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

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <PageHeader
        title={copy.title}
        description={copy.description}
        mascot="/mascots/mascot2.png"
        mascotSize="lg"
        className="md:items-center"
      />

      <ol className="mt-10 space-y-14 sm:mt-14">
        {copy.steps.map((step, index) => (
          <li key={step.image} className="flex flex-col gap-5 sm:gap-6">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-base font-bold text-white">
                {index + 1}
              </span>
              <p className="pt-1.5 text-base leading-7 text-foreground-secondary sm:text-lg sm:leading-8">
                {step.instruction}
              </p>
            </div>

            <div className="relative mx-auto aspect-[18/35] w-full max-w-[280px] overflow-hidden rounded-2xl border border-border bg-background shadow-xl sm:max-w-[320px]">
              <Image
                src={step.image}
                alt={step.imageAlt}
                fill
                sizes="(max-width: 640px) 85vw, 320px"
                className="object-contain"
                priority={index === 0}
              />
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-lg border border-border bg-background-card/70 p-4 text-sm text-foreground-secondary backdrop-blur sm:mt-14">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
          <p>{copy.note}</p>
        </div>
      </div>
    </section>
  );
}
