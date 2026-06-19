import { getAccountInitial, getAccountLabel } from "@/features/auth/account-display";
import type { AuthShellUser } from "@/features/auth/auth-types";

const baseUser: AuthShellUser = {
  id: "user-1",
  email: "deniz@example.com",
  profile: {
    displayName: null,
    preferredLanguageCode: null,
    preferredUiLocale: null,
    preferredTier: null,
    aiPracticePoints: 0,
    chestPoints: 0,
  },
};

describe("account display helpers", () => {
  it("uses the email first letter when display name is empty", () => {
    expect(getAccountInitial(baseUser)).toBe("D");
    expect(getAccountLabel(baseUser)).toBe("deniz@example.com");
  });

  it("prefers display name for the avatar initial and label", () => {
    const user = {
      ...baseUser,
      profile: {
        ...baseUser.profile,
        displayName: "Çağla",
      },
    };

    expect(getAccountInitial(user)).toBe("Ç");
    expect(getAccountLabel(user)).toBe("Çağla");
  });
});
