"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function QuizSkipButton({
  className,
  disabled = false,
  hidden = false,
  onClick,
}: {
  className?: string;
  disabled?: boolean;
  hidden?: boolean;
  onClick: () => void;
}) {
  const t = useT();

  return (
    <Button
      type="button"
      variant="danger"
      className={cn("quiz-action-scale bg-rose-500 text-white hover:bg-rose-600", className)}
      data-quiz-skip
      data-quiz-action-hidden={hidden}
      disabled={disabled || hidden}
      onClick={onClick}
    >
      {t("cards.skip")}
    </Button>
  );
}
