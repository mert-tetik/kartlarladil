import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
  indicatorOverlayClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
  indicatorOverlayClassName?: string;
}) {
  const boundedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-border", className)}>
      <div
        data-progress-indicator
        className={cn("relative h-full overflow-hidden rounded-full bg-background-inverse transition-all", indicatorClassName)}
        style={{ width: `${boundedValue}%` }}
      >
        {indicatorOverlayClassName ? (
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute inset-0", indicatorOverlayClassName)}
            data-progress-indicator-overlay
          />
        ) : null}
      </div>
    </div>
  );
}
