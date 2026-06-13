import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LANGUAGE_BY_CODE } from "@/data/languages";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { InventoryDashboard } from "@/features/inventory/components/inventory-dashboard";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/kartlarim",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/features/inventory/cloud-actions", () => ({
  addCloudInventoryCardAction: vi.fn(),
  listCloudInventoryAction: vi.fn(),
  migrateLocalInventoryToCloudAction: vi.fn(),
  recordCloudPracticeAttemptAction: vi.fn(),
  resetCloudInventoryAction: vi.fn(),
}));

describe("InventoryDashboard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useInventoryStore.setState({
      cards: [],
      attempts: [],
      hydrated: true,
      cloudEnabled: false,
      cloudLoading: false,
      cloudError: "",
    });
  });

  it("shows country flags in the language buttons", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <AuthSessionProvider user={null}>
          <InventoryDashboard />
        </AuthSessionProvider>
      </LocaleProvider>,
    );

    expect(screen.getByRole("img", { name: LANGUAGE_BY_CODE.en.nativeName })).toBeVisible();
    expect(screen.getByRole("img", { name: LANGUAGE_BY_CODE.de.nativeName })).toBeVisible();
    expect(screen.getByRole("img", { name: LANGUAGE_BY_CODE.ru.nativeName })).toBeVisible();
  });
});
