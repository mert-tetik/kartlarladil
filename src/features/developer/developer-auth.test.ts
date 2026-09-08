import { afterEach, describe, expect, it } from "vitest";
import { isDeveloperAdminEmail } from "./developer-auth";

const originalAdminEmails = process.env.DEVELOPER_ADMIN_EMAILS;

afterEach(() => {
  if (originalAdminEmails === undefined) {
    delete process.env.DEVELOPER_ADMIN_EMAILS;
    return;
  }

  process.env.DEVELOPER_ADMIN_EMAILS = originalAdminEmails;
});

describe("isDeveloperAdminEmail", () => {
  it("only accepts normalized addresses included in the server allowlist", () => {
    process.env.DEVELOPER_ADMIN_EMAILS = " owner@example.com,operator@example.com ";

    expect(isDeveloperAdminEmail("OWNER@example.com")).toBe(true);
    expect(isDeveloperAdminEmail("operator@example.com")).toBe(true);
    expect(isDeveloperAdminEmail("member@example.com")).toBe(false);
    expect(isDeveloperAdminEmail(undefined)).toBe(false);
  });
});
