import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeAppLaunchContentGate } from "@/features/auth/components/native-app-launch-content-gate";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isSessionReady: false,
}));
const inventoryState = vi.hoisted(() => ({
  hydrated: false,
  ownerUserId: null as string | null,
}));

vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: () => authState,
}));
vi.mock("@/features/inventory/inventory-store", () => ({
  useInventoryStore: (selector: (state: typeof inventoryState) => unknown) => selector(inventoryState),
}));

describe("NativeAppLaunchContentGate", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isSessionReady = false;
    inventoryState.hydrated = false;
    inventoryState.ownerUserId = null;
  });

  afterEach(() => cleanup());

  it("keeps the landing hidden until native-launch session restoration confirms a user", () => {
    const view = render(
      <NativeAppLaunchContentGate enabled>
        <main>Landing page</main>
      </NativeAppLaunchContentGate>,
    );

    expect(screen.queryByText("Landing page")).not.toBeInTheDocument();

    authState.isSessionReady = true;
    view.rerender(
      <NativeAppLaunchContentGate enabled>
        <main>Landing page</main>
      </NativeAppLaunchContentGate>,
    );
    expect(screen.queryByText("Landing page")).not.toBeInTheDocument();

    authState.user = { id: "signed-in-user" };
    inventoryState.hydrated = true;
    view.rerender(
      <NativeAppLaunchContentGate enabled>
        <main>Landing page</main>
      </NativeAppLaunchContentGate>,
    );
    expect(screen.getByText("Landing page")).toBeInTheDocument();

    inventoryState.ownerUserId = "another-user";
    view.rerender(
      <NativeAppLaunchContentGate enabled>
        <main>Landing page</main>
      </NativeAppLaunchContentGate>,
    );
    expect(screen.queryByText("Landing page")).not.toBeInTheDocument();

    inventoryState.ownerUserId = "signed-in-user";
    view.rerender(
      <NativeAppLaunchContentGate enabled>
        <main>Landing page</main>
      </NativeAppLaunchContentGate>,
    );
    expect(screen.getByText("Landing page")).toBeInTheDocument();
  });

  it("does not expose a signed-in landing before local hydration or across account owners", () => {
    authState.user = { id: "signed-in-user" };
    authState.isSessionReady = true;
    inventoryState.hydrated = true;
    inventoryState.ownerUserId = "another-user";

    const view = render(
      <NativeAppLaunchContentGate enabled>
        <main>Landing page</main>
      </NativeAppLaunchContentGate>,
    );

    expect(screen.queryByText("Landing page")).not.toBeInTheDocument();

    inventoryState.ownerUserId = null;
    view.rerender(
      <NativeAppLaunchContentGate enabled>
        <main>Landing page</main>
      </NativeAppLaunchContentGate>,
    );
    expect(screen.getByText("Landing page")).toBeInTheDocument();
  });

  it("does not change regular website landing rendering", () => {
    render(
      <NativeAppLaunchContentGate enabled={false}>
        <main>Landing page</main>
      </NativeAppLaunchContentGate>,
    );

    expect(screen.getByText("Landing page")).toBeInTheDocument();
  });
});
