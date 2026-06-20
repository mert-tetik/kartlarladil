import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AskSectionProps {
  title: string;
  description: string;
  cta: string;
  href: string;
}

export function AskSection({ title, description, cta, href }: AskSectionProps) {
  return (
    <section className="border-y border-slate-200 bg-white dark:border-border dark:bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <Image
                src="/mascots/mascot1.png"
                alt=""
                width={72}
                height={76}
                className="h-auto w-[72px] object-contain"
                priority
              />
              <div className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm">
                <MessageCircleQuestion className="size-4" aria-hidden="true" />
              </div>
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">{title}</h2>
              <p className="mt-2 max-w-xl text-base leading-7 text-slate-600 dark:text-foreground-secondary">{description}</p>
            </div>
          </div>
          <Link
            href={href}
            className={cn(
              buttonClassName("primary", "lg"),
              "w-full justify-center bg-brand hover:bg-brand-hover md:w-auto",
            )}
          >
            {cta}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
