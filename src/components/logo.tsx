import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  size?: number;
  className?: string;
  priority?: boolean;
}

export function Logo({ size = 40, className, priority }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="FoxiesDeck"
      width={size}
      height={size}
      className={cn("rounded-md object-contain", className)}
      priority={priority}
    />
  );
}
