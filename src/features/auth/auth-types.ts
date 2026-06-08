import type { LanguageCode } from "@/types/domain";
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
  preferredTier: Tier | null;
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
