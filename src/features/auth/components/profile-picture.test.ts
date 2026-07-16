import { describe, expect, it } from "vitest";
import { getProfilePictureSource } from "@/features/auth/components/profile-picture";

describe("getProfilePictureSource", () => {
  it("maps the database index range to its matching profile picture asset", () => {
    expect(getProfilePictureSource(0)).toBe("/profile-pictures/pp_1.png");
    expect(getProfilePictureSource(18)).toBe("/profile-pictures/pp_19.png");
  });

  it("falls back to the first profile picture for invalid values", () => {
    expect(getProfilePictureSource(-1)).toBe("/profile-pictures/pp_1.png");
    expect(getProfilePictureSource(19)).toBe("/profile-pictures/pp_1.png");
    expect(getProfilePictureSource(null)).toBe("/profile-pictures/pp_1.png");
  });
});
