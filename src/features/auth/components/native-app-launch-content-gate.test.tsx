import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NativeAppLaunchContentGate } from "@/features/auth/components/native-app-launch-content-gate";

const authState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isSessionReady: false,
}));

vi.mock("@/features/auth/auth-client", () => ({
  useAuthSession: () => authState,
}));

describe("NativeAppLaunchContentGate", () => {
  beforeEach(() => {
    authState.user = null;
    authState.isSessionReady = false;
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
