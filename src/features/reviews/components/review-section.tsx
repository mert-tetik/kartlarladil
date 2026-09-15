"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Send } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { submitReviewAction } from "@/features/reviews/actions";
import { StarRating } from "@/features/reviews/components/star-rating";
import { useLocale } from "@/i18n/locale-provider";
import { canUseSuperWater, formatSuperWaterText } from "@/lib/super-water";
import { cn } from "@/lib/utils";
import type { AuthShellUser } from "@/features/auth/auth-types";

interface ReviewSectionProps {
  user: AuthShellUser | null;
  existingReview?: {
    rating: number;
    comment: string;
  } | null;
  t: {
    title: string;
    description: string;
    ratingLabel: string;
    commentLabel: string;
    commentPlaceholder: string;
    submit: string;
    loginRequired: string;
    login: string;
    success: string;
    error: string;
    invalidRating: string;
    back: string;
  };
  variant?: "desktop" | "mobile";
}

export function ReviewSection({ user, existingReview, t, variant = "desktop" }: ReviewSectionProps) {
  const { locale } = useLocale();
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const isSubmitDisabled = status === "loading" || rating < 1;
  const useSuperWater = canUseSuperWater(locale);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (rating < 1 || rating > 5) {
      setStatus("error");
      setErrorMessage(t.invalidRating);
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    const result = await submitReviewAction(rating, comment);

    if (result.status === "success") {
      setStatus("success");
    } else {
      setStatus("error");
      setErrorMessage(result.message === "login_required" ? t.loginRequired : t.error);
    }
  };

  const formContent = !user ? (
    <div className="text-center">
      <p className="text-sm text-foreground-secondary">{t.loginRequired}</p>
      <Link
        href={`/login?next=${encodeURIComponent("/")}`}
        className={cn(buttonClassName("primary", "md"), "mt-4 inline-flex")}
      >
        {t.login}
      </Link>
    </div>
  ) : status === "success" ? (
    <div className="w-full text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <Send className="size-7" aria-hidden="true" />
      </div>
      <p className={cn("mt-4 text-lg font-semibold", variant === "mobile" ? "text-white" : "text-foreground")}>
        {t.success}
      </p>
    </div>
  ) : (
    <form onSubmit={handleSubmit} className={cn("space-y-6", variant === "mobile" && "space-y-5 text-center")}>
      <StarRating
        value={rating}
        onChange={setRating}
        label={formatSuperWaterText(locale, t.ratingLabel)}
        size="lg"
        centered={variant === "mobile"}
        superWater={useSuperWater}
      />

      <div className={cn("flex flex-col gap-2", variant === "mobile" && "items-center")}>
        <label
          htmlFor={variant === "mobile" ? "mobile-review-comment" : "review-comment"}
          className={cn(
            "text-center text-sm font-semibold text-foreground-secondary",
            useSuperWater && "font-super-water",
          )}
        >
          {formatSuperWaterText(locale, t.commentLabel)}
        </label>
        <textarea
          id={variant === "mobile" ? "mobile-review-comment" : "review-comment"}
          name="comment"
          rows={4}
          maxLength={2000}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t.commentPlaceholder}
          className="w-full resize-none rounded-xl border border-border bg-[color-mix(in_oklab,var(--background),black_20%)] px-4 py-3 text-left text-sm leading-6 text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>

      {status === "error" && errorMessage ? (
        <p role="alert" className="text-sm font-medium text-red-600">{errorMessage}</p>
      ) : null}

      {variant === "mobile" ? (
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={cn(
            "h-14 w-full rounded-xl bg-brand px-4 text-lg font-bold text-brand-foreground transition-transform active:scale-[0.985] disabled:cursor-not-allowed disabled:brightness-[0.52] disabled:saturate-[0.7]",
            useSuperWater && "font-super-water",
          )}
        >
          {status === "loading" ? "…" : formatSuperWaterText(locale, t.submit)}
        </button>
      ) : (
        <button
          type="submit"
          disabled={status === "loading" || rating < 1}
          className={cn(
            buttonClassName("primary", "md", "w-full justify-center sm:w-auto"),
            "bg-brand text-brand-foreground hover:bg-brand-hover",
            useSuperWater && "font-super-water",
          )}
        >
          {formatSuperWaterText(locale, t.submit)}
        </button>
      )}
    </form>
  );

  if (variant === "mobile") {
    return (
      <section data-mobile-contact-page className="relative isolate min-h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] w-full overflow-hidden bg-[#121212] text-white">
        <div className="relative flex min-h-[calc(100dvh-var(--app-header-height)-var(--mobile-nav-bar-height))] w-full flex-col">
          <Link
            href="/"
            className="mb-4 hidden w-full items-center justify-center gap-2 text-center text-sm font-semibold text-white/70 transition-colors hover:text-white lg:inline-flex"
          >
            <span aria-hidden="true">←</span>
            {t.back}
          </Link>

          <div className="relative overflow-hidden bg-brand px-5 pb-6 pt-8 text-center sm:px-8">
            <h1 className={cn("mt-0 text-3xl font-semibold leading-tight text-brand-foreground sm:text-4xl", useSuperWater && "font-super-water")}>
              {formatSuperWaterText(locale, t.title)}
            </h1>
            <p className={cn("mx-auto mt-3 max-w-md text-sm leading-6 text-brand-foreground/80", useSuperWater && "font-super-water")}>
              {formatSuperWaterText(locale, t.description)}
            </p>
          </div>

          <div className={cn(
            "border-t border-white/10 bg-transparent px-4 py-5 sm:px-8 sm:py-7",
            status === "success"
              ? "flex flex-1 flex-col items-center justify-center"
              : null,
          )}>
            {formContent}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative isolate overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5]">
        <Image
          src="/mascots/mascot13.webp"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center brightness-[0.35]"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-black/70" />
      <div className="relative mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">{t.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-white">{t.description}</p>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-background-card p-6 shadow-sm sm:p-8">
          {formContent}
        </div>
      </div>
    </section>
  );
}
