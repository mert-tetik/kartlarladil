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

function createTarget({
  name = "landing-draw-cards",
  rect = { left: 100, top: 200, width: 80, height: 40 },
}: {
  name?: string;
  rect?: { left: number; top: number; width: number; height: number };
} = {}) {
  const target = document.createElement("button");
  target.setAttribute("data-tutorial-target", name);
  target.style.position = "absolute";
  target.style.left = `${rect.left}px`;
  target.style.top = `${rect.top}px`;
  target.style.width = `${rect.width}px`;
  target.style.height = `${rect.height}px`;
  document.body.appendChild(target);

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

describe("TutorialPointer", () => {
  beforeEach(() => {
    useTutorialStore.setState({ completed: false, step: 0 });
    document.body.innerHTML = "";
    window.history.pushState({}, "", "/");
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

  it("advances the tutorial when the target is clicked", async () => {
    setMobileViewport();
    const target = createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).toBeInTheDocument();
    });

    fireEvent.pointerDown(target);

    expect(useTutorialStore.getState().step).toBe(1);
  });

  it("does not advance when a fallback target is clicked", async () => {
    setMobileViewport();
    useTutorialStore.setState({ completed: false, step: 2 });
    const target = createTarget();

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).toBeInTheDocument();
    });

    fireEvent.pointerDown(target);

    expect(useTutorialStore.getState().step).toBe(2);
  });

  it("ignores hidden fallback targets that remain mounted", async () => {
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
      const pointer = document.querySelector(".tutorial-pointer") as HTMLElement;
      expect(pointer).toBeInTheDocument();
      expect(pointer.getAttribute("data-tutorial-target-key")).toBe("landing-draw-cards");
      expect(pointer.style.left).toBe("118px");
      expect(pointer.style.top).toBe("204px");
    });
  });

  it("does not advance the tier step from pointerdown", async () => {
    setMobileViewport();
    useTutorialStore.setState({ completed: false, step: 1 });
    createTarget({ name: "tier-choice" });

    render(<TutorialPointer />);

    await waitFor(() => {
      expect(document.querySelector(".tutorial-pointer")).toBeInTheDocument();
    });

    fireEvent.pointerDown(document.querySelector('[data-tutorial-target="tier-choice"]')!);

    expect(useTutorialStore.getState().step).toBe(1);
  });
});
