import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  mascot,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  mascot?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-3xl">
        <div className="flex items-center gap-4">
          {mascot ? (
            <div className="relative hidden h-16 w-16 shrink-0 md:block">
              <Image src={mascot} alt="" fill sizes="64px" className="object-contain" />
            </div>
          ) : null}
          <h1 className="font-display text-4xl font-semibold text-foreground md:text-5xl">{title}</h1>
        </div>
        {description ? (
          <p className="mt-3 max-w-2xl text-base leading-7 text-foreground-secondary">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
