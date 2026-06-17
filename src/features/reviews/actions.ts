"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAuthUser } from "@/features/auth/auth-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ReviewSubmissionResult {
  status: "success" | "error";
  message: string;
}

export async function submitReviewAction(
  rating: number,
  comment: string,
): Promise<ReviewSubmissionResult> {
  const user = await getCurrentAuthUser();

  if (!user) {
    return { status: "error", message: "login_required" };
  }

  const normalizedRating = Math.round(rating);
  const normalizedComment = comment.trim();

  if (normalizedRating < 1 || normalizedRating > 5) {
    return { status: "error", message: "invalid_rating" };
  }

  if (normalizedComment.length > 2000) {
    return { status: "error", message: "comment_too_long" };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("reviews").upsert(
    {
      user_id: user.id,
      rating: normalizedRating,
      comment: normalizedComment,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { status: "error", message: "unknown" };
  }

  revalidatePath("/");

  return { status: "success", message: "submitted" };
}
