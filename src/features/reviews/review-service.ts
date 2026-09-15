import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ExistingReview {
  rating: number;
  comment: string;
}

export async function getExistingReview(userId: string): Promise<ExistingReview | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("reviews")
    .select("rating, comment")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    rating: data.rating as number,
    comment: (data.comment as string) ?? "",
  };
}
