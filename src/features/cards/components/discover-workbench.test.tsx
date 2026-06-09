import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { DiscoverWorkbench } from "@/features/cards/components/discover-workbench";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import type { AuthShellUser } from "@/features/auth/auth-types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/kesfet",
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

const testUser: AuthShellUser = {
  id: "user-1",
  email: "test@example.com",
  profile: {
    displayName: "Test User",
    preferredLanguageCode: "en",
    preferredTier: "A1",
  },
};

describe("DiscoverWorkbench", () => {
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

  it("shrinks a skipped card before removing it from the discover grid", async () => {
    const user = userEvent.setup();
    const { container } = renderWorkbench();

    await revealAppleCard(user);
    await user.click(screen.getByRole("button", { name: "Geç" }));

    expect(container.querySelector('[data-discover-exit-kind="skip"]')).toBeInTheDocument();
  });

  it("moves an added card upward before writing it to the inventory", async () => {
    const user = userEvent.setup();
    const { container } = renderWorkbench();

    await revealAppleCard(user);
    await user.click(screen.getByRole("button", { name: "Ekle" }));

    expect(container.querySelector('[data-discover-exit-kind="add"]')).toBeInTheDocument();
    await waitFor(() => expect(useInventoryStore.getState().hasCard("en-a1-isim-apple")).toBe(true));
  });
});

function renderWorkbench() {
  return render(
    <AuthSessionProvider user={testUser}>
      <DiscoverWorkbench />
    </AuthSessionProvider>,
  );
}

async function revealAppleCard(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByPlaceholderText(/Kelime/), { target: { value: "apple" } });
  await user.click(screen.getByRole("button", { name: "Ara" }));
  await user.click(await screen.findByRole("button", { name: "apple kartını çevir" }));
  await screen.findByRole("heading", { name: "apple" });
}
