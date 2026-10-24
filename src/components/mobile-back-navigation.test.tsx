import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePathname, useRouter } from "next/navigation";
import { MobileBackNavigation } from "@/components/mobile-back-navigation";
import { setMobileNavbarBackOverride } from "@/components/mobile-navbar-back";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  setMobileNavbarBackOverride(false);
  delete window.__foxiesDeckHandleAndroidBack;
  document.body.innerHTML = "";
});

describe("MobileBackNavigation", () => {
  it("closes the topmost closeable mobile surface first", async () => {
    vi.mocked(usePathname).mockReturnValue("/card-draw");
    vi.mocked(useRouter).mockReturnValue({ push: routerPush } as never);
    const onClose = vi.fn();

    render(
      <>
        <MobileBackNavigation />
        <button type="button" data-mobile-back-close onClick={onClose} />
      </>,
    );

    await waitFor(() => expect(window.__foxiesDeckHandleAndroidBack).toBeTypeOf("function"));
    expect(window.__foxiesDeckHandleAndroidBack?.()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("sends non-landing routes to the landing page when no surface is open", async () => {
    vi.mocked(usePathname).mockReturnValue("/learn");
    vi.mocked(useRouter).mockReturnValue({ push: routerPush } as never);

    render(<MobileBackNavigation />);

    await waitFor(() => expect(window.__foxiesDeckHandleAndroidBack).toBeTypeOf("function"));
    expect(window.__foxiesDeckHandleAndroidBack?.()).toBe(true);
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/"));
  });

  it("returns false on the landing page so Android can close the app", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    vi.mocked(useRouter).mockReturnValue({ push: routerPush } as never);

    render(<MobileBackNavigation />);

    await waitFor(() => expect(window.__foxiesDeckHandleAndroidBack).toBeTypeOf("function"));
    expect(window.__foxiesDeckHandleAndroidBack?.()).toBe(false);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("uses the navbar back override before routing", async () => {
    vi.mocked(usePathname).mockReturnValue("/");
    vi.mocked(useRouter).mockReturnValue({ push: routerPush } as never);
    const overrideListener = vi.fn();
    const handler = () => overrideListener();
    window.addEventListener("foxiesdeck:mobile-navbar-back-request", handler);

    setMobileNavbarBackOverride(true);
    render(<MobileBackNavigation />);

    await waitFor(() => expect(window.__foxiesDeckHandleAndroidBack).toBeTypeOf("function"));
    expect(window.__foxiesDeckHandleAndroidBack?.()).toBe(true);
    expect(overrideListener).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();

    setMobileNavbarBackOverride(false);
    window.removeEventListener("foxiesdeck:mobile-navbar-back-request", handler);
  });
});
