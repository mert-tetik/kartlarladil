import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppMessageProvider, useAppMessage } from "@/components/app-message-provider";

function MessageTrigger() {
  const { showMessage } = useAppMessage();

  return (
    <button type="button" onClick={() => showMessage("Test message")}>
      Show message
    </button>
  );
}

function renderMessage() {
  render(
    <AppMessageProvider>
      <MessageTrigger />
    </AppMessageProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Show message" }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AppMessageProvider", () => {
  it("keeps the default message visible for five seconds", () => {
    vi.useFakeTimers();
    renderMessage();

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4_999);
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1 + 420);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("dismisses after a horizontal swipe", () => {
    vi.useFakeTimers();
    renderMessage();

    const message = screen.getByRole("status");
    Object.defineProperties(message, {
      hasPointerCapture: { value: () => true },
      releasePointerCapture: { value: vi.fn() },
      setPointerCapture: { value: vi.fn() },
    });

    fireEvent.pointerDown(message, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 240,
      button: 0,
    });
    fireEvent.pointerMove(message, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
    });
    fireEvent.pointerUp(message, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
    });

    expect(message).toHaveAttribute("data-app-message-dragging", "false");
    expect(message).toHaveClass("opacity-0");

    act(() => {
      vi.advanceTimersByTime(420);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows messages posted by the embedded offline shell", () => {
    render(
      <AppMessageProvider>
        <iframe title="Offline screen" data-offline-shell-frame="true" />
      </AppMessageProvider>,
    );
    const offlineFrame = document.querySelector<HTMLIFrameElement>('iframe[data-offline-shell-frame="true"]');

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: window.location.origin,
        source: offlineFrame?.contentWindow,
        data: { type: "foxiesdeck:app-message", message: "Still offline", tone: "error" },
      }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Still offline");
  });

  it("ignores messages from another origin", () => {
    render(
      <AppMessageProvider>
        <iframe title="Offline screen" data-offline-shell-frame="true" />
      </AppMessageProvider>,
    );
    const offlineFrame = document.querySelector<HTMLIFrameElement>('iframe[data-offline-shell-frame="true"]');

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "https://example.com",
        source: offlineFrame?.contentWindow,
        data: { type: "foxiesdeck:app-message", message: "Untrusted", tone: "error" },
      }));
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
