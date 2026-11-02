"use client";

import { useEffect, useRef } from "react";
import { useAuthSession } from "@/features/auth/auth-client";
import { clearQuizPoolCache } from "@/features/quiz/quiz-pool-preparation";

export function QuizPoolAuthBoundary() {
  const { user } = useAuthSession();
  const previousUserIdRef = useRef(user?.id ?? null);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (previousUserIdRef.current !== nextUserId) {
      previousUserIdRef.current = nextUserId;
      clearQuizPoolCache();
    }
  }, [user?.id]);

  return null;
}
