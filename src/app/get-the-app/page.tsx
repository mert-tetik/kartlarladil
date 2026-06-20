import type { Metadata } from "next";
import { ExternalLink, Info, Smartphone } from "lucide-react";
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
    <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title={copy.title}
          description={copy.description}
          mascot="/mascots/mascot2.png"
          mascotSize="lg"
          className="md:items-center"
        />

        <div className="mt-6 rounded-lg border border-border bg-background-card/70 p-4 text-sm text-foreground-secondary backdrop-blur">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <p>{copy.note}</p>
          </div>
          <div className="mt-3 flex items-start gap-3">
            <ExternalLink className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <p>{copy.fallback}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {copy.sections.map((section) => (
            <section key={section.title} className="rounded-lg border border-border bg-background-card/70 p-5 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-brand/12 text-brand">
                  <Smartphone className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {section.guides.map((guide) => (
                  <article key={`${section.title}-${guide.browser}`} className="rounded-md border border-border/80 bg-background px-4 py-4">
                    <h3 className="text-base font-semibold text-foreground">{guide.browser}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground-secondary">{guide.instruction}</p>
                    {guide.note ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{guide.note}</p> : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
