import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SlowConnectionMonitorErrorBoundary } from "@/components/slow-connection-monitor-error-boundary";
import { logSlowConnectionMonitorError } from "@/components/slow-connection-monitor-logger";

afterEach(() => {
  vi.restoreAllMocks();
});

it("contains a monitor render error without hiding the rest of the app shell", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  function BrokenMonitorChild(): never {
    throw new Error("monitor render failed");
  }

  render(
    <>
      <p>App shell remains available</p>
      <SlowConnectionMonitorErrorBoundary>
        <BrokenMonitorChild />
      </SlowConnectionMonitorErrorBoundary>
    </>,
  );

  expect(screen.getByText("App shell remains available")).toBeInTheDocument();
  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining("[FoxiesDeck slow-connection monitor] render failed"),
    expect.any(Error),
    expect.objectContaining({ componentStack: expect.any(String) }),
  );
});

it("does not let a broken console prevent monitor errors from being contained", () => {
  vi.spyOn(console, "error").mockImplementation(() => {
    throw new Error("console unavailable");
  });

  expect(() => logSlowConnectionMonitorError("test diagnostic", new Error("test"))).not.toThrow();
});
