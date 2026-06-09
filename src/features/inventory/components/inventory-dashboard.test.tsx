import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { InventoryDashboard } from "@/features/inventory/components/inventory-dashboard";
import { useInventoryStore } from "@/features/inventory/inventory-store";

vi.mock("next/navigation", () => ({
  usePathname: () => "/kartlarim",
  useRouter: () => ({
    push: vi.fn(),
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
      <AuthSessionProvider user={null}>
        <InventoryDashboard />
      </AuthSessionProvider>,
    );

    expect(screen.getByRole("img", { name: /İngilizce bayrağı/ })).toBeVisible();
    expect(screen.getByRole("img", { name: /Almanca bayrağı/ })).toBeVisible();
    expect(screen.getByRole("img", { name: /Rusça bayrağı/ })).toBeVisible();
  });
});
