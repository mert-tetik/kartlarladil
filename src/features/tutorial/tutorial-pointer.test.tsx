import { render, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { usePathname } from "next/navigation";
import { TutorialPointer } from "@/features/tutorial/tutorial-pointer";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

function setMobileViewport() {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 412 });
  window.dispatchEvent(new Event("resize"));
}

function setDesktopViewport() {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1280 });
  window.dispatchEvent(new Event("resize"));
}

function createTarget() {
  const target = document.createElement("button");
  target.setAttribute("data-tutorial-target", "landing-draw-cards");
  target.style.position = "absolute";
  target.style.left = "100px";
  target.style.top = "200px";
  target.style.width = "80px";
  target.style.height = "40px";
  document.body.appendChild(target);

  target.getBoundingClientRect = () => ({
    x: 100,
    y: 200,
    width: 80,
    height: 40,
    top: 200,
    left: 100,
    right: 180,
    bottom: 240,
    toJSON: () => {},
  });

  return target;
}

describe("TutorialPointer", () => {
  beforeEach(() => {
    useTutorialStore.setState({ completed: false, step: 0 });
    document.body.innerHTML = "";
    vi.mocked(usePathname).mockReturnValue("/");
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
      expect(pointer.style.left).toBe("116px"); // 100 + 80/2 - 24
      expect(pointer.style.top).toBe("144px"); // 200 - 56
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
});
