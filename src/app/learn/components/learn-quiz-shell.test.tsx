import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { LearnQuizShell } from "@/app/learn/components/learn-quiz-shell";
import { useInventoryStore } from "@/features/inventory/inventory-store";
import { LocaleProvider } from "@/i18n/locale-provider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/learn",
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

describe("LearnQuizShell", () => {
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

  it("shows only the no-card empty state when the user has no cards", () => {
    render(
      <LocaleProvider initialLocale="tr">
        <LearnQuizShell
          title="Kartları öğren"
          description="Kartları çalış"
          initialMode={null}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole("heading", { name: /Hen/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /Kart/ })).toHaveAttribute("href", "/card-draw");
    expect(screen.queryByText(/Nas/)).not.toBeInTheDocument();
  });
});
