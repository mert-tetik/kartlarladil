import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    aiPracticePoints: 0,
    chestPoints: 0,
  },
};

const testCard = VOCABULARY_CARDS.find((card) => card.language === "en" && card.tier === "A1")!;
const defaultViewport = {
  innerHeight: window.innerHeight,
  innerWidth: window.innerWidth,
  visualViewport: window.visualViewport,
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

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.removeAttribute("style");
    document.documentElement.removeAttribute("style");
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: defaultViewport.innerHeight,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: defaultViewport.innerWidth,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: defaultViewport.visualViewport,
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

  it("keeps an owned card searchable and blocks adding it again", async () => {
    const user = userEvent.setup();

    useInventoryStore.setState({
      cards: [
        {
          cardId: testCard.id,
          status: "active",
          correctCount: 1,
          addedAt: new Date().toISOString(),
        },
      ],
    });

    renderWorkbench();

    await revealTestCard(user);
    await user.click(screen.getByRole("button", { name: "Ekle" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(useInventoryStore.getState().cards).toHaveLength(1);
  });

  it("keeps mobile draw controls at the bottom of the workbench and makes cards scroll between controls", async () => {
    installMobileKeyboardEnvironment({ viewportHeight: 844 });

    const { container } = renderWorkbench();

    const controls = container.querySelector("[data-card-draw-controls]") as HTMLElement;
    const drawActions = container.querySelector("[data-card-draw-draw-actions]") as HTMLElement;
    const filters = container.querySelector("[data-card-draw-filters]") as HTMLElement;
    const scrollArea = container.querySelector("[data-card-draw-scroll-area]") as HTMLElement;

    expect(controls).toHaveClass("max-lg:order-3", "max-lg:shrink-0");
    expect(controls).not.toHaveClass("max-lg:fixed");
    expect(scrollArea).toHaveClass("max-lg:order-2", "max-lg:flex-1", "max-lg:overflow-y-auto");
    expect(drawActions).not.toHaveClass("max-lg:hidden");
    expect(filters).not.toHaveClass("max-lg:hidden");
    expect(getMobileSearchInput(container)).toBeVisible();
  });
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
  const mobileSearchPanel = getMobileSearchPanel(document.body);
  fireEvent.change(getMobileSearchInput(mobileSearchPanel), { target: { value: testCard.term } });
  await user.click(await within(mobileSearchPanel).findByRole("button", { name: new RegExp(testCard.term) }));
  await user.click(await screen.findByRole("button", { name: `${testCard.term}: Çevirmek için tıkla` }));
  await screen.findByRole("heading", { name: testCard.term });
}

function getMobileSearchInput(container: HTMLElement) {
  return container.querySelector("[data-card-draw-mobile-search] [data-card-draw-search-input]") as HTMLInputElement;
}

function getMobileSearchPanel(container: HTMLElement) {
  return container.querySelector("[data-card-draw-mobile-search]") as HTMLElement;
}

function installMobileKeyboardEnvironment({
  innerHeight = 844,
  viewportHeight,
}: {
  innerHeight?: number;
  viewportHeight: number;
}) {
  const listeners = {
    resize: new Set<() => void>(),
    scroll: new Set<() => void>(),
  };
  const visualViewport = {
    height: viewportHeight,
    offsetTop: 0,
    addEventListener: vi.fn((event: "resize" | "scroll", listener: () => void) => {
      listeners[event].add(listener);
    }),
    removeEventListener: vi.fn((event: "resize" | "scroll", listener: () => void) => {
      listeners[event].delete(listener);
    }),
  };

  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: query === "(max-width: 1023px)",
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: innerHeight,
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 390,
  });
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: visualViewport,
  });

  return {
    setViewportHeight(nextHeight: number) {
      visualViewport.height = nextHeight;
      listeners.resize.forEach((listener) => listener());
    },
    setLayoutViewportHeight(nextHeight: number) {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: nextHeight,
      });
      visualViewport.height = nextHeight;
      window.dispatchEvent(new Event("resize"));
      listeners.resize.forEach((listener) => listener());
    },
  };
}
