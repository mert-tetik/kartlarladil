import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "light" | "dark";
  size?: number;
  className?: string;
  priority?: boolean;
}

export function Logo({ variant = "light", size = 40, className, priority }: LogoProps) {
  const src = variant === "dark" ? "/logo-dark.png" : "/logo.png";

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
