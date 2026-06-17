import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const boundedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-border", className)}>
      <div
        className={cn("h-full rounded-full bg-background-inverse transition-all", indicatorClassName)}
        style={{ width: `${boundedValue}%` }}
      />
    </div>
  );
}
