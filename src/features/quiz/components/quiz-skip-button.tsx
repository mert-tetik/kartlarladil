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
    <div
      className={cn("quiz-action-depth quiz-action-depth--skip w-full min-w-0", className)}
      data-quiz-action-hidden={hidden}
    >
      <Button
        type="button"
        variant="danger"
        className="quiz-action-scale w-full bg-rose-500 text-white hover:bg-rose-600"
        data-quiz-skip
        data-quiz-action-hidden={hidden}
        disabled={disabled || hidden}
        onClick={onClick}
      >
        {t("cards.skip")}
      </Button>
    </div>
  );
}
