"use client";

import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { buttonClassName } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function NoCardsEmptyState({
  variant,
  className,
}: {
  variant: "inventory" | "learn";
  className?: string;
}) {
  const t = useT();
  const titleKey =
    variant === "learn" ? "quiz.noCardsTitle" : "inventory.noCardsTitle";
  const descriptionKey =
    variant === "learn"
      ? "quiz.noCardsDescription"
      : "inventory.noCardsDescription";

  return (
    <div
      className={cn("flex min-h-0 flex-1 items-center justify-center p-4", className)}
      data-no-cards-empty-state={variant}
    >
      <EmptyState
        mascot="/mascots/mascot17.png"
        title={t(titleKey)}
        description={t(descriptionKey)}
        action={
          <Link href="/card-draw" className={buttonClassName("primary", "md")}>
            {t("nav.cardDraw")}
          </Link>
        }
      />
    </div>
  );
}
