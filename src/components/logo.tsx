import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "default" | "inverted";
  size?: number;
  className?: string;
  priority?: boolean;
}

export function Logo({ variant = "default", size = 40, className, priority }: LogoProps) {
  const src = variant === "inverted" ? "/logo-inverted.png" : "/logo.png";

  return (
    <Image
      src={src}
      alt="Kartlarla Dil"
      width={size}
      height={size}
      className={cn("rounded-md object-contain", className)}
      priority={priority}
    />
  );
}
