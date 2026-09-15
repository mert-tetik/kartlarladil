import { StrictMode, createRef, type RefObject } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GemRewardFlight } from "@/features/progress/components/gem-reward-flight";

vi.mock("@/lib/sound-effects", () => ({
  playSoundEffect: vi.fn(),
}));

vi.mock("@/lib/vibration", () => ({
  vibrate: vi.fn(),
}));

function flightRect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

function FlightHarness({ sourceRef }: { sourceRef: RefObject<HTMLDivElement | null> }) {
  return (
    <>
      <div ref={sourceRef} data-flight-source />
      <span data-reward-gem-target="blue" />
      <GemRewardFlight
        rewards={[{ type: "blue", amount: 2 }]}
        sourceRef={sourceRef}
        sourceOrigin="center"
      />
    </>
  );
}

describe("GemRewardFlight", () => {
  it("waits for source geometry instead of completing before icons can mount", async () => {
    const sourceRef = createRef<HTMLDivElement>();
    let sourceMeasurements = 0;
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute("data-flight-source")) {
        sourceMeasurements += 1;
        return sourceMeasurements < 2 ? flightRect(0, 0, 0, 0) : flightRect(100, 160, 120, 80);
      }
      if (this.hasAttribute("data-reward-gem-target")) {
        return flightRect(320, 40, 44, 44);
      }
      return flightRect(0, 0, 0, 0);
    });

    try {
      render(
        <StrictMode>
          <FlightHarness sourceRef={sourceRef} />
        </StrictMode>,
      );

      await waitFor(() => {
        expect(document.querySelectorAll(".animate-quiz-score-icon-flight")).toHaveLength(2);
      });
    } finally {
      rectSpy.mockRestore();
    }
  });
});
