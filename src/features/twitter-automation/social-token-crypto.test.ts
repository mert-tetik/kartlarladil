import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSocialProviderToken, encryptSocialProviderToken } from "@/features/twitter-automation/social-token-crypto";

const originalKey = process.env.SOCIAL_AUTOMATION_TOKEN_ENCRYPTION_KEY;

beforeEach(() => {
  process.env.SOCIAL_AUTOMATION_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64url");
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.SOCIAL_AUTOMATION_TOKEN_ENCRYPTION_KEY;
  else process.env.SOCIAL_AUTOMATION_TOKEN_ENCRYPTION_KEY = originalKey;
});

describe("social provider token encryption", () => {
  it("round-trips a token without preserving its plaintext", () => {
    const token = "provider-access-token";
    const encrypted = encryptSocialProviderToken(token);

    expect(encrypted).not.toContain(token);
    expect(decryptSocialProviderToken(encrypted)).toBe(token);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptSocialProviderToken("provider-access-token");
    const segments = encrypted.split(".");
    const ciphertext = segments[2]!;
    segments[2] = `${ciphertext.startsWith("A") ? "B" : "A"}${ciphertext.slice(1)}`;

    expect(() => decryptSocialProviderToken(segments.join("."))).toThrow("could not be decrypted");
  });
});
