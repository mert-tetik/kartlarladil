import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { GlobalTapVibration } from "@/components/global-tap-vibration";

const vibrateMock = vi.fn();

vi.mock("@/lib/vibration", () => ({
  vibrate: (...args: unknown[]) => vibrateMock(...args),
}));

describe("GlobalTapVibration", () => {
  beforeEach(() => {
    vibrateMock.mockReset();
  });

  it("does not vibrate on pointer down before the click is completed", () => {
    render(
      <>
        <GlobalTapVibration />
        <button type="button">Open</button>
      </>,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Open" }));

    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it("vibrates after a real click on a clickable element", () => {
    render(
      <>
        <GlobalTapVibration />
        <button type="button">Open</button>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(vibrateMock).toHaveBeenCalledWith("tap");
  });

  it("does not vibrate for disabled buttons", () => {
    render(
      <>
        <GlobalTapVibration />
        <button type="button" disabled>
          Disabled
        </button>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Disabled" }));

    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it("does not vibrate when the click was prevented", () => {
    render(
      <>
        <GlobalTapVibration />
        <button type="button">Blocked</button>
      </>,
    );

    const blockedButton = screen.getByRole("button", { name: "Blocked" });
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    event.preventDefault();
    blockedButton.dispatchEvent(event);

    expect(vibrateMock).not.toHaveBeenCalled();
  });
});
