import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
  {
    variants: {
      variant: {
        primary: "bg-slate-950 text-white hover:bg-slate-800",
        secondary: "border border-slate-200 bg-white text-slate-950 hover:bg-slate-100",
        ghost: "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
        danger: "bg-rose-600 text-white hover:bg-rose-700",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-10 px-4",
        lg: "h-12 px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function buttonClassName(variant: ButtonProps["variant"], size: ButtonProps["size"], className?: string) {
  return cn(buttonVariants({ variant, size }), className);
}
