import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { CardDrawWorkbench } from "@/features/cards/components/card-draw-workbench";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import type { AuthShellUser } from "@/features/auth/auth-types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/kart-cek",
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

describe("CardDrawWorkbench", () => {
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

  it("shrinks a skipped card before removing it from the card draw grid", async () => {
    const user = userEvent.setup();
    const { container } = renderWorkbench();

    await revealAppleCard(user);
    await user.click(screen.getByRole("button", { name: "Geç" }));

    expect(container.querySelector('[data-card-draw-exit-kind="skip"]')).toBeInTheDocument();
  }, 20_000);

  it("moves an added card upward before writing it to the inventory", async () => {
    const user = userEvent.setup();
    const { container } = renderWorkbench();

    await revealAppleCard(user);
    await user.click(screen.getByRole("button", { name: "Ekle" }));

    expect(container.querySelector('[data-card-draw-exit-kind="add"]')).toBeInTheDocument();
    await waitFor(() => expect(useInventoryStore.getState().hasCard("en-a1-isim-apple")).toBe(true));
  }, 20_000);
});

function renderWorkbench() {
  return render(
    <AuthSessionProvider user={testUser}>
      <CardDrawWorkbench />
    </AuthSessionProvider>,
  );
}

async function revealAppleCard(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByPlaceholderText(/Kelime/), { target: { value: "apple" } });
  await user.click(screen.getByRole("button", { name: "Ara" }));
  await user.click(await screen.findByRole("button", { name: "apple kartını çevir" }));
  await screen.findByRole("heading", { name: "apple" });
}
