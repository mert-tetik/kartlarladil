import Image from "next/image";
import { cn } from "@/lib/utils";

export function ScoreIcon({
  className,
  size = 20,
  alt = "",
}: {
  className?: string;
  size?: number;
  alt?: string;
}) {
  return (
    <Image
      src="/score-icon.webp"
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      aria-hidden={alt === ""}
    />
  );
}
