import { Loader2 } from "lucide-react";

export function RouteLoadingState() {
  return (
    <section className="mx-auto flex h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] min-h-0 max-w-7xl items-center justify-center bg-background px-4 py-16 text-foreground max-lg:h-[calc(100dvh-8rem)] max-lg:max-h-[calc(100dvh-8rem)] sm:px-6 lg:px-8">
      <Loader2 className="size-6 animate-spin text-foreground" role="status" aria-label="Loading page" />
      <span className="sr-only">Loading page</span>
    </section>
  );
}
