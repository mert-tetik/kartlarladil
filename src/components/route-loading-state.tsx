import { Loader2 } from "lucide-react";

export function RouteLoadingState() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <Loader2 className="size-6 animate-spin text-foreground" role="status" aria-label="Loading page" />
      <span className="sr-only">Loading page</span>
    </section>
  );
}
