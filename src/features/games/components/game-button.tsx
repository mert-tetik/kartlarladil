"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "blue" | "red" | "brand";
  size?: "md" | "lg";
}

export function GameButton({ variant = "brand", size = "md", className, children, ...props }: GameButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-black uppercase tracking-wide transition-transform active:scale-95 disabled:opacity-50",
        variant === "blue" && "bg-blue-500 text-white hover:bg-blue-600",
        variant === "red" && "bg-red-500 text-white hover:bg-red-600",
        variant === "brand" && "bg-brand text-brand-foreground hover:bg-brand-hover",
        size === "md" && "min-h-[3.5rem] px-6 text-lg",
        size === "lg" && "min-h-[4.5rem] px-8 text-xl",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
