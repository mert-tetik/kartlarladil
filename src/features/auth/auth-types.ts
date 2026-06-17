import type { LanguageCode, LocaleCode } from "@/types/domain";
import type { Tier } from "@/types/domain";

export type AuthActionStatus = "idle" | "success" | "error";

export interface AuthActionState {
  status: AuthActionStatus;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
}

export interface AuthProfile {
  displayName: string | null;
  preferredLanguageCode: LanguageCode | null;
  preferredUiLocale: LocaleCode | null;
  preferredTier: Tier | null;
  aiPracticePoints: number;
  theme?: string | null;
}

export interface AuthShellUser {
  id: string;
  email: string;
  profile: AuthProfile;
}

export const AUTH_ACTION_IDLE_STATE: AuthActionState = {
  status: "idle",
  message: "",
};
