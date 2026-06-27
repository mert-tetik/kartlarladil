import { render, fireEvent, waitFor } from "@testing-library/react";
import { TutorialPointer } from "@/features/tutorial/tutorial-pointer";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";

function setMobileViewport() {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 412 });
  window.dispatchEvent(new Event("resize"));
}

function setDesktopViewport() {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1280 });
  window.dispatchEvent(new Event("resize"));
}

function setSearchParams(search: string) {
  const url = new URL(window.location.href);
  url.search = search;
  window.history.pushState({}, "", url.toString());
}

function createTarget({
  name = "landing-draw-cards",
  rect = { left: 100, top: 200, width: 80, height: 40 },
  parent = document.body,
}: {
  name?: string;
  rect?: { left: number; top: number; width: number; height: number };
  parent?: HTMLElement;
} = {}) {
  const target = document.createElement("button");
  target.setAttribute("data-tutorial-target", name);
  target.style.position = "absolute";
  target.style.left = `${rect.left}px`;
  target.style.top = `${rect.top}px`;
  target.style.width = `${rect.width}px`;
  target.style.height = `${rect.height}px`;
  parent.appendChild(target);

  target.getBoundingClientRect = () => ({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => {},
  });

  return target;
}

function createVisibleOverlay() {
  const overlay = document.createElement("div");
  overlay.setAttribute("role", "dialog");
  document.body.appendChild(overlay);

  overlay.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width: 412,
    height: 800,
    top: 0,
    left: 0,
    right: 412,
    bottom: 800,
    toJSON: () => {},
  });

  return overlay;
}

function createVisibleCookieNotice() {
  const notice = document.createElement("div");
  notice.setAttribute("data-cookie-notice", "");
  document.body.appendChild(notice);

  notice.getBoundingClientRect = () => ({
    x: 0,
    y: 700,
    width: 412,
    height: 100,
    top: 700,
    left: 0,
    right: 412,
    bottom: 800,
    toJSON: () => {},
  });

  return notice;
}

describe("TutorialPointer", () => {
  beforeEach(() => {
    useTutorialStore.setState({ completed: false, step: 0, testMode: false });
    document.body.innerHTML = "";
    window.history.pushState({}, "", "/");
    setSearchParams("");
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the pointer above the current target on mobile", async () => {
    setMobileViewport();
    createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      const pointer = document.querySelector(".tutorial-pointer") as HTMLElement;
      expect(pointer).toBeInTheDocument();
      expect(pointer.style.left).toBe("118px"); // 100 + 80/2 - hotspot x
      expect(pointer.style.top).toBe("204px"); // 200 + 40/2 - hotspot y
    });
  });

  it("keeps the pointer inside the viewport for top-edge targets", async () => {
    setMobileViewport();
    window.history.pushState({}, "", "/card-draw");
    useTutorialStore.setState({ completed: false, step: 3 });
    createTarget({
      name: "draw-card-result",
      rect: { left: 8, top: 8, width: 40, height: 40 },
    });

    render(<TutorialPointer />);

    await waitFor(() => {
      const pointer = document.querySelector(".tutorial-pointer") as HTMLElement;
      expect(pointer).toBeInTheDocument();
      expect(Number.parseFloat(pointer.style.left)).toBeGreaterThanOrEqual(4);
      expect(Number.parseFloat(pointer.style.top)).toBeGreaterThanOrEqual(4);
    });
  });

  it("does not render on desktop", async () => {
    setDesktopViewport();
    createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("does not render when completed", async () => {
    setMobileViewport();
    useTutorialStore.setState({ completed: true, step: 5 });
    createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("does not render on suppressed pages", async () => {
    setMobileViewport();
    window.history.pushState({}, "", "/pricing");
    createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("advances the tutorial when an automatic target is clicked", async () => {
    setMobileViewport();
    window.history.pushState({}, "", "/card-draw");
    useTutorialStore.setState({ completed: false, step: 2 });
    const target = createTarget({ name: "draw-cards-action" });

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).toBeInTheDocument();
    });

    fireEvent.pointerDown(target);

    expect(useTutorialStore.getState().step).toBe(3);
  });

  it("does not render when the current step target is missing", async () => {
    setMobileViewport();
    useTutorialStore.setState({ completed: false, step: 2 });
    createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("does not fall back to an earlier step when the current step target is missing", async () => {
    setMobileViewport();
    useTutorialStore.setState({ completed: false, step: 2 });
    createTarget({ name: "landing-draw-cards" });
    const hiddenTarget = createTarget({
      name: "tier-choice",
      rect: { left: 20, top: 20, width: 120, height: 56 },
    });
    hiddenTarget.setAttribute("aria-hidden", "true");

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("renders the tier target on the landing tier selector", async () => {
    setMobileViewport();
    window.history.pushState({}, "", "/");
    useTutorialStore.setState({ completed: false, step: 1 });
    const overlay = createVisibleOverlay();
    overlay.setAttribute("data-mobile-tier-selector", "");
    createTarget({ name: "tier-choice", parent: overlay });

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).toBeInTheDocument();
    });
  });

  it("does not auto-advance the tier target because tier selection advances it manually", async () => {
    setMobileViewport();
    window.history.pushState({}, "", "/");
    useTutorialStore.setState({ completed: false, step: 1 });
    const target = createTarget({ name: "tier-choice" });

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).toBeInTheDocument();
    });

    fireEvent.pointerDown(target);

    expect(useTutorialStore.getState().step).toBe(1);
  });

  it("hides while a visible dialog outside the target is open", async () => {
    setMobileViewport();
    createTarget();
    createVisibleOverlay();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("hides while the cookie notice covers the current target", async () => {
    setMobileViewport();
    window.history.pushState({}, "", "/card-draw");
    useTutorialStore.setState({ completed: false, step: 2 });
    createTarget({
      name: "draw-cards-action",
      rect: { left: 8, top: 728, width: 374, height: 48 },
    });
    createVisibleCookieNotice();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("completes when the start learning target is clicked", async () => {
    setMobileViewport();
    useTutorialStore.setState({ completed: false, step: 6 });
    const target = createTarget({ name: "start-learning" });
    target.setAttribute("aria-disabled", "true");

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).toBeInTheDocument();
    });

    fireEvent.pointerDown(target);

    expect(useTutorialStore.getState().step).toBe(7);
    expect(useTutorialStore.getState().completed).toBe(true);
  });

  it("renders when completed if test mode is enabled", async () => {
    setMobileViewport();
    useTutorialStore.setState({ completed: true, step: 0, testMode: true });
    createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).toBeInTheDocument();
    });
  });

  it("does not render on desktop even if test mode is enabled", async () => {
    setDesktopViewport();
    useTutorialStore.setState({ testMode: true });
    createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("does not render on suppressed pages even if test mode is enabled", async () => {
    setMobileViewport();
    window.history.pushState({}, "", "/pricing");
    useTutorialStore.setState({ testMode: true });
    createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("does not render over a visible dialog even if test mode is enabled", async () => {
    setMobileViewport();
    useTutorialStore.setState({ testMode: true });
    createTarget();
    createVisibleOverlay();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("does not show a fallback position in test mode when no target exists", async () => {
    setMobileViewport();
    useTutorialStore.setState({ completed: true, step: 0, testMode: true });

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).not.toBeInTheDocument();
    });
  });

  it("enables test mode from the tutorial-test query param", async () => {
    setMobileViewport();
    setSearchParams("?tutorial-test=1");
    createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(useTutorialStore.getState().testMode).toBe(true);
      expect(document.querySelector(".tutorial-pointer")).toBeInTheDocument();
    });
  });

  it("resets the tutorial to step 0 when test mode is enabled from URL", async () => {
    setMobileViewport();
    useTutorialStore.setState({ completed: true, step: 7, testMode: false });
    setSearchParams("?tutorial-test=1");
    createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(useTutorialStore.getState().testMode).toBe(true);
      expect(useTutorialStore.getState().completed).toBe(false);
      expect(useTutorialStore.getState().step).toBe(0);
      expect(document.querySelector(".tutorial-pointer")).toBeInTheDocument();
    });
  });
});
