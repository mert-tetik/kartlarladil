import {
  DELETE_ACCOUNT_CONFIRMATION,
  deleteAccountSchema,
  loginSchema,
  onboardingSchema,
  profileSchema,
  updatePasswordSchema,
} from "@/features/auth/auth-schemas";

describe("auth schemas", () => {
  it("rejects invalid login email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret1",
      next: "/my-cards",
    });

    expect(result.success).toBe(false);
  });

  it("rejects mismatched password updates", () => {
    const result = updatePasswordSchema.safeParse({
      password: "secret1",
      confirmPassword: "secret2",
    });

    expect(result.success).toBe(false);
  });

  it("normalizes optional profile fields", () => {
    const result = profileSchema.safeParse({
      displayName: "  Deniz  ",
      preferredLanguageCode: "ru",
      preferredUiLocale: "tr",
      preferredTier: "B1",
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data : null).toEqual({
      displayName: "Deniz",
      preferredLanguageCode: "ru",
      preferredUiLocale: "tr",
      preferredTier: "B1",
    });
  });

  it("accepts all as onboarding preferred tier", () => {
    const result = onboardingSchema.safeParse({
      preferredLanguageCode: "en",
      preferredUiLocale: "tr",
      preferredTier: "all",
      next: "/card-draw",
    });

    expect(result.success).toBe(true);
  });

  it("accepts all as profile preferred tier", () => {
    const result = profileSchema.safeParse({
      displayName: "Deniz",
      preferredLanguageCode: "ru",
      preferredUiLocale: "tr",
      preferredTier: "all",
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data.preferredTier : null).toBe("all");
  });

  it("rejects invalid tier values", () => {
    expect(
      onboardingSchema.safeParse({
        preferredLanguageCode: "en",
        preferredUiLocale: "tr",
        preferredTier: "C2",
      }).success,
    ).toBe(false);
  });

  it("requires explicit delete confirmation", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "delete" }).success).toBe(false);
    expect(deleteAccountSchema.safeParse({ confirmation: DELETE_ACCOUNT_CONFIRMATION }).success).toBe(true);
  });
});
