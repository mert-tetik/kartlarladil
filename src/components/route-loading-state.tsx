import { Loader2 } from "lucide-react";

export function RouteLoadingState() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="page-loading-card" role="status" aria-label="Loading page">
        <Loader2 className="size-6 animate-spin text-slate-950" aria-hidden="true" />
        <span className="sr-only">Loading page</span>
      </div>
    </section>
  );
}
