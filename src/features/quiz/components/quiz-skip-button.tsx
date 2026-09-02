"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function QuizSkipButton({
  className,
  disabled = false,
  onClick,
}: {
  className?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const t = useT();

  return (
    <Button
      type="button"
      variant="danger"
      className={cn("bg-rose-500 text-white hover:bg-rose-600", className)}
      data-quiz-skip
      disabled={disabled}
      onClick={onClick}
    >
      {t("cards.skip")}
    </Button>
  );
}
