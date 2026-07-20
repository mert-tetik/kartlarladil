import Image from "next/image";
import { cn } from "@/lib/utils";

export function MissionIcon({
  className,
  size = 24,
  alt = "",
}: {
  className?: string;
  size?: number;
  alt?: string;
}) {
  return (
    <Image
      src="/mission-icon.webp"
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0 object-contain", className)}
      aria-hidden={alt === ""}
    />
  );
}
