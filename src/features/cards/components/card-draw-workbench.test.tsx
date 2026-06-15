import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { AuthSessionProvider } from "@/features/auth/auth-client";
import { CardDrawWorkbench } from "@/features/cards/components/card-draw-workbench";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { LocaleProvider } from "@/i18n/locale-provider";
import type { AuthShellUser } from "@/features/auth/auth-types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/card-draw",
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

const testUser: AuthShellUser = {
  id: "user-1",
  email: "test@example.com",
  profile: {
    displayName: "Test User",
    preferredLanguageCode: "en",
    preferredUiLocale: "tr",
    preferredTier: "A1",
  },
};

const testCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1")!;

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

    await revealTestCard(user);
    await user.click(screen.getByRole("button", { name: "Geç" }));

    await waitFor(() => {
      expect(container.querySelector('[data-card-draw-exit-kind="skip"]')).toBeInTheDocument();
    });
  }, 20_000);

  it("moves an added card upward before writing it to the inventory", async () => {
    const user = userEvent.setup();
    const { container } = renderWorkbench();

    await revealTestCard(user);
    await user.click(screen.getByRole("button", { name: "Ekle" }));

    expect(container.querySelector('[data-card-draw-exit-kind="add"]')).toBeInTheDocument();
    await waitFor(() => expect(useInventoryStore.getState().hasCard(testCard.id)).toBe(true));
  }, 20_000);
});

function renderWorkbench() {
  return render(
    <LocaleProvider initialLocale="tr">
      <AuthSessionProvider user={testUser}>
        <CardDrawWorkbench />
      </AuthSessionProvider>
    </LocaleProvider>,
  );
}

async function revealTestCard(user: ReturnType<typeof userEvent.setup>) {
  fireEvent.change(screen.getByPlaceholderText(/Kelime/), { target: { value: testCard.term } });
  await user.click(screen.getByRole("button", { name: "Ara" }));
  await user.click(await screen.findByRole("button", { name: `${testCard.term}: Çevirmek için tıkla` }));
  await screen.findByRole("heading", { name: testCard.term });
}
