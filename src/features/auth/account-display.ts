import type { AuthShellUser } from "@/features/auth/auth-types";

export function getAccountInitial(user: Pick<AuthShellUser, "email" | "profile">) {
  const source = user.profile.displayName?.trim() || user.email.trim();
  return source.slice(0, 1).toLocaleUpperCase("tr-TR") || "?";
}

export function getAccountLabel(user: Pick<AuthShellUser, "email" | "profile">) {
  return user.profile.displayName?.trim() || user.email;
}
