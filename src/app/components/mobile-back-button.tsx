"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { vibrate } from "@/lib/vibration";

export function MobileBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  const visible = shouldShowMobileBackButton(pathname);

  if (!visible) {
    return null;
  }

  function handleBack() {
    vibrate("tap");

    if (pathname === "/card-draw" || pathname === "/learn" || pathname === "/learned") {
      router.push("/");
      return;
    }

    if (pathname.startsWith("/ai-practice/")) {
      const segments = pathname.split("/").filter(Boolean);
      // /ai-practice/[language]/[character] -> /ai-practice/[language]
      // /ai-practice/[language] -> /ai-practice
      if (segments.length >= 3) {
        router.push(`/${segments.slice(0, 2).join("/")}`);
        return;
      }
      router.push("/ai-practice");
      return;
    }

    router.back();
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Geri dön"
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10",
        "lg:hidden",
      )}
    >
      <ArrowLeft className="size-6" aria-hidden="true" />
    </button>
  );
}

export function shouldShowMobileBackButton(pathname: string): boolean {
  if (pathname === "/") return false;
  if (pathname === "/ask" || pathname.startsWith("/ask/")) return false;
  if (pathname === "/pricing") return false;
  if (pathname === "/profile") return false;
  if (pathname.startsWith("/account/")) return false;
  if (pathname.startsWith("/terms") || pathname.startsWith("/privacy") || pathname.startsWith("/refund") || pathname.startsWith("/cookies") || pathname.startsWith("/subscriptions")) return false;

  return true;
}
