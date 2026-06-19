import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const MASCOT_SIZE_CLASSES = {
  sm: "h-8 w-8 md:h-12 md:w-12",
  md: "h-10 w-10 md:h-16 md:w-16",
  lg: "h-12 w-12 md:h-24 md:w-24",
  xl: "h-16 w-16 md:h-32 md:w-32",
  "2xl": "h-20 w-20 md:h-40 md:w-40",
} as const;

const MASCOT_IMAGE_SIZES = {
  sm: "48px",
  md: "64px",
  lg: "96px",
  xl: "128px",
  "2xl": "160px",
} as const;

export function PageHeader({
  title,
  description,
  action,
  mascot,
  mascotSize = "md",
  centered = false,
  className,
  titleClassName,
  descriptionClassName,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  mascot?: string;
  mascotSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  centered?: boolean;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", centered ? "items-center text-center md:items-center md:justify-center" : "md:flex-row md:items-end md:justify-between", className)}>
      <div className={cn("max-w-3xl", centered && "mx-auto")}>
        <div className={cn("flex items-center gap-4", centered && "justify-center")}>
          {mascot ? (
            <div className={cn("relative shrink-0", MASCOT_SIZE_CLASSES[mascotSize])}>
              <Image src={mascot} alt="" fill sizes={MASCOT_IMAGE_SIZES[mascotSize]} className="object-contain" />
            </div>
          ) : null}
          <h1 className={cn("font-display font-semibold text-foreground", titleClassName ?? "text-4xl md:text-5xl")}>{title}</h1>
        </div>
        {description ? (
          <p className={cn("mt-3 max-w-2xl text-base leading-7 text-foreground-secondary", centered && "mx-auto", descriptionClassName)}>{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
