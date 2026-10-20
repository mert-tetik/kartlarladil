import { fireEvent, render, screen } from "@testing-library/react";
import { AppRenderErrorFallback } from "@/components/app-render-error-fallback";

describe("AppRenderErrorFallback", () => {
  it("shows recovery actions and logs diagnostics without rendering error details", async () => {
    const error = Object.assign(new Error("private diagnostic detail"), { digest: "digest-123" });
    const onRetry = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <AppRenderErrorFallback
        error={error}
        title="Page couldn’t load"
        description="Something went wrong while loading this page."
        retryLabel="Try again"
        reloadLabel="Reload page"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("heading", { name: "Page couldn’t load" })).toBeInTheDocument();
    expect(screen.getByText("Something went wrong while loading this page.")).toBeInTheDocument();
    expect(screen.queryByText("private diagnostic detail")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "[FoxiesDeck] A render error was contained by an application boundary.",
        expect.objectContaining({ digest: "digest-123", message: "private diagnostic detail" }),
      );
    });

    consoleError.mockRestore();
  });
});
