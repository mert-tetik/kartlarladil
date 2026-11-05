import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MobileGoogleAuthLoading } from "@/features/auth/components/mobile-google-auth-loading";
import { LocaleProvider } from "@/i18n/locale-provider";

describe("MobileGoogleAuthLoading", () => {
  it("marks the whole verification UI as one scale-out screen", () => {
    const { container } = render(
      <LocaleProvider initialLocale="en">
        <MobileGoogleAuthLoading />
      </LocaleProvider>,
    );

    const screen = container.querySelector<HTMLElement>("[data-google-auth-loading]");
    expect(screen).toHaveAttribute("data-gateway-flow-screen-exit");
    expect(screen?.querySelector(".animate-spin")).toBeInTheDocument();
    expect(screen?.querySelector("p")).toBeInTheDocument();
    expect(screen?.querySelectorAll("[data-gateway-flow-item]")).toHaveLength(0);
  });
});
