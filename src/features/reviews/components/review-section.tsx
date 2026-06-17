"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Send } from "lucide-react";
import { buttonClassName } from "@/components/ui/button";
import { submitReviewAction } from "@/features/reviews/actions";
import { StarRating } from "@/features/reviews/components/star-rating";
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
  };
}

export function ReviewSection({ user, existingReview, t }: ReviewSectionProps) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

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

  return (
    <section className="relative isolate overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5]">
        <Image
          src="/mascots/mascot13.png"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center brightness-[0.35]"
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-black/25" />
      <div className="relative mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">{t.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-foreground-secondary">{t.description}</p>
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-background-card p-6 shadow-sm sm:p-8">
          {!user ? (
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
            <div className="text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Send className="size-7" aria-hidden="true" />
              </div>
              <p className="mt-4 text-lg font-semibold text-foreground">{t.success}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <StarRating
                value={rating}
                onChange={setRating}
                label={t.ratingLabel}
                size="lg"
              />

              <div className="flex flex-col gap-2">
                <label htmlFor="review-comment" className="text-sm font-semibold text-foreground-secondary">
                  {t.commentLabel}
                </label>
                <textarea
                  id="review-comment"
                  name="comment"
                  rows={4}
                  maxLength={2000}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={t.commentPlaceholder}
                  className="w-full resize-none rounded-lg border border-border bg-background-card px-4 py-3 text-sm text-foreground placeholder:text-foreground-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <p className="text-right text-xs text-foreground-muted">{comment.length}/2000</p>
              </div>

              {status === "error" && errorMessage ? (
                <p className="text-sm font-medium text-red-600">{errorMessage}</p>
              ) : null}

              <button
                type="submit"
                disabled={status === "loading" || rating < 1}
                className={cn(
                  buttonClassName("primary", "md", "w-full justify-center sm:w-auto"),
                  "bg-brand text-brand-foreground hover:bg-brand-hover",
                )}
              >
                {t.submit}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
