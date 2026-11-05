import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { GlobalTapVibration } from "@/components/global-tap-vibration";

const vibrateMock = vi.fn();
const playFlowButtonSoundMock = vi.fn();

vi.mock("@/lib/vibration", () => ({
  vibrate: (...args: unknown[]) => vibrateMock(...args),
}));

vi.mock("@/lib/flow-button-sound", () => ({
  playFlowButtonSound: (...args: unknown[]) => playFlowButtonSoundMock(...args),
}));

describe("GlobalTapVibration", () => {
  beforeEach(() => {
    vibrateMock.mockReset();
    playFlowButtonSoundMock.mockReset();
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

  it("uses a firm vibration inside explicitly marked flows", () => {
    render(
      <>
        <GlobalTapVibration />
        <div data-tap-vibration="firm">
          <button type="button">Continue</button>
        </div>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(vibrateMock).toHaveBeenCalledWith("firm-tap");
  });

  it("uses firm vibration for tutorial targets and tutorial-layer actions", () => {
    const { rerender } = render(
      <>
        <GlobalTapVibration />
        <div data-landing-tutorial />
        <button type="button" data-tutorial-target="start-learning">Start</button>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(vibrateMock).toHaveBeenLastCalledWith("firm-tap");

    vibrateMock.mockClear();
    rerender(
      <>
        <GlobalTapVibration />
        <div data-tutorial-layer="draw-cards">
          <button type="button">Close</button>
        </div>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(vibrateMock).toHaveBeenCalledWith("firm-tap");
  });

  it("leaves tutorial controls to their own haptic handler instead of double vibrating", () => {
    render(
      <>
        <GlobalTapVibration />
        <div data-landing-tutorial>
          <button type="button" data-landing-tutorial-next>Next</button>
        </div>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(vibrateMock).not.toHaveBeenCalled();
    expect(playFlowButtonSoundMock).toHaveBeenCalledWith("tutorial");
  });

  it("plays the auth sequence for buttons inside the marked login and onboarding flow", () => {
    render(
      <>
        <GlobalTapVibration />
        <div data-flow-button-sound="auth">
          <button type="button">Choose language</button>
        </div>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose language" }));

    expect(playFlowButtonSoundMock).toHaveBeenCalledWith("auth");
    expect(vibrateMock).toHaveBeenCalledWith("tap");
  });

  it("firm-vibrates auth and onboarding buttons before a handler can prevent the click", () => {
    render(
      <>
        <GlobalTapVibration />
        <div data-mobile-auth-gateway data-tap-vibration="firm">
          <button type="button" onClick={(event) => event.preventDefault()}>
            Choose native language
          </button>
        </div>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Choose native language" }));

    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenCalledWith("firm-tap");
  });

  it("does not double-vibrate ordinary auth gateway button clicks", () => {
    render(
      <>
        <GlobalTapVibration />
        <div data-mobile-auth-gateway data-tap-vibration="firm" data-flow-button-sound="auth">
          <button type="button">Continue</button>
        </div>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(vibrateMock).toHaveBeenCalledTimes(1);
    expect(vibrateMock).toHaveBeenCalledWith("firm-tap");
    expect(playFlowButtonSoundMock).toHaveBeenCalledWith("auth");
  });

  it("still sounds tutorial buttons that suppress haptics", () => {
    render(
      <>
        <GlobalTapVibration />
        <div data-landing-tutorial />
        <button type="button" data-no-tap-vibrate>Continue silently</button>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue silently" }));

    expect(playFlowButtonSoundMock).toHaveBeenCalledWith("tutorial");
    expect(vibrateMock).not.toHaveBeenCalled();
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
