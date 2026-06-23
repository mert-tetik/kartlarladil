import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMobileKeyboardDock } from "./use-mobile-keyboard-dock";

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function mockVisualViewport(snapshot: { height: number; offsetTop?: number }) {
  Object.defineProperty(window, "visualViewport", {
    writable: true,
    value: {
      height: snapshot.height,
      offsetTop: snapshot.offsetTop ?? 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;

describe("useMobileKeyboardDock", () => {
  beforeEach(() => {
    mockMatchMedia(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
    Object.defineProperty(window, "visualViewport", {
      writable: true,
      value: undefined,
    });
  });

  it("returns keyboard closed with zero offset on mobile when visual viewport fills the screen", () => {
    window.innerWidth = 400;
    window.innerHeight = 844;
    mockVisualViewport({ height: 844 });

    const { result } = renderHook(() => useMobileKeyboardDock());

    expect(result.current.isMobileViewport).toBe(true);
    expect(result.current.isKeyboardOpen).toBe(false);
    expect(result.current.keyboardOffset).toBe(0);
  });

  it("returns keyboard open with positive offset when visual viewport shrinks", () => {
    window.innerWidth = 400;
    window.innerHeight = 844;
    mockVisualViewport({ height: 500 });

    const { result } = renderHook(() => useMobileKeyboardDock());

    expect(result.current.isKeyboardOpen).toBe(true);
    expect(result.current.keyboardOffset).toBe(844 - 500);
  });

  it("detects keyboard open from baseline when layout viewport also shrinks", () => {
    const listeners = new Set<() => void>();
    window.innerWidth = 400;
    window.innerHeight = 844;
    const visualViewport = {
      height: 844,
      offsetTop: 0,
      addEventListener: (event: string, listener: () => void) => {
        if (event === "resize") listeners.add(listener);
      },
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, "visualViewport", {
      writable: true,
      value: visualViewport,
    });

    const { result } = renderHook(() => useMobileKeyboardDock());
    expect(result.current.isKeyboardOpen).toBe(false);

    window.innerHeight = 500;
    visualViewport.height = 500;
    act(() => {
      listeners.forEach((listener) => listener());
    });

    expect(result.current.isKeyboardOpen).toBe(true);
    expect(result.current.keyboardOffset).toBeGreaterThan(0);
  });

  it("returns desktop state when viewport is wide", () => {
    mockMatchMedia(false);
    window.innerWidth = 1280;
    window.innerHeight = 844;
    mockVisualViewport({ height: 500 });

    const { result } = renderHook(() => useMobileKeyboardDock());

    expect(result.current.isMobileViewport).toBe(false);
    expect(result.current.isKeyboardOpen).toBe(false);
    expect(result.current.keyboardOffset).toBe(0);
  });
});
