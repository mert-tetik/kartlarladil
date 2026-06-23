import Image from "next/image";
import { cn } from "@/lib/utils";

export function EmptyState({
  mascot,
  title,
  description,
  action,
  className,
}: {
  mascot?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-dashed border-transparent bg-transparent p-8 text-center", className)}>
      <div className="relative mx-auto h-32 w-32">
        <Image
          src={mascot ?? "/mascots/mascot12.png"}
          alt=""
          fill
          sizes="128px"
          className="object-contain"
        />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-foreground-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
