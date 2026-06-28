import { useCallback, useEffect, useMemo, useState } from "react";
import type { SubscriptionPlan } from "@/types/domain";

const STORAGE_KEY = "foxiesdeck:ai-quiz-validation:daily";
const FREE_DAILY_LIMIT = 15;

interface LimitState {
  date: string;
  count: number;
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function readState(): LimitState {
  if (typeof window === "undefined") {
    return { date: getToday(), count: 0 };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { date: getToday(), count: 0 };
    }

    const parsed = JSON.parse(raw) as Partial<LimitState>;
    const today = getToday();

    if (parsed.date !== today || typeof parsed.count !== "number") {
      return { date: today, count: 0 };
    }

    return { date: today, count: Math.max(0, parsed.count) };
  } catch {
    return { date: getToday(), count: 0 };
  }
}

function writeState(state: LimitState): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function useAiQuizValidationLimit(plan: SubscriptionPlan) {
  const [state, setState] = useState<LimitState>(() => readState());

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setState(readState());
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isUnlimited = plan !== "free";

  const remaining = useMemo(() => {
    if (isUnlimited) return Number.POSITIVE_INFINITY;
    return Math.max(0, FREE_DAILY_LIMIT - state.count);
  }, [isUnlimited, state.count]);

  const canUse = useCallback(() => {
    return isUnlimited || remaining > 0;
  }, [isUnlimited, remaining]);

  const consume = useCallback(() => {
    if (isUnlimited) return;

    const current = readState();
    const next = { date: getToday(), count: current.count + 1 };
    writeState(next);
    setState(next);
  }, [isUnlimited]);

  return { canUse, consume, remaining };
}
