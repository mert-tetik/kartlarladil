"use client";

import { LoaderCircle, MonitorCog } from "lucide-react";
import { useEffect, useState } from "react";
import { GeneratedPostsTable } from "@/features/twitter-automation/components/generated-posts-table";
import type { AutomationScope } from "@/features/twitter-automation/automation-scope";

type ActiveOutput = { run_id: string; run?: { status?: string; created_at?: string } | null };

export function AutomationRendererAgent() {
  const [activeRun, setActiveRun] = useState<{ id: string; scope: AutomationScope } | null>(null);
  const [state, setState] = useState<"connecting" | "idle" | "working" | "error">("connecting");

  useEffect(() => {
    let disposed = false;
    let timer: number | null = null;
    const findRun = async () => {
      try {
        const [productionResponse, testResponse] = await Promise.all([
          fetch("/api/twitter-automation/automation-runs?scope=production&active=1", { cache: "no-store" }),
          fetch("/api/twitter-automation/automation-runs?scope=test&active=1", { cache: "no-store" }),
        ]);
        if (!productionResponse.ok || !testResponse.ok) throw new Error("renderer_queue_unavailable");
        const [productionPayload, testPayload] = await Promise.all([
          productionResponse.json() as Promise<{ outputs?: ActiveOutput[] }>,
          testResponse.json() as Promise<{ outputs?: ActiveOutput[] }>,
        ]);
        const selectable = (outputs: ActiveOutput[]) => outputs.find((output) => output.run?.status === "queued" || output.run?.status === "processing" || output.run?.status === "ready_to_schedule");
        const productionCandidate = selectable(productionPayload.outputs ?? []);
        const testCandidate = selectable(testPayload.outputs ?? []);
        const candidate = productionCandidate ? { id: productionCandidate.run_id, scope: "production" as const } : testCandidate ? { id: testCandidate.run_id, scope: "test" as const } : null;
        if (disposed) return;
        if (candidate) {
          setActiveRun(candidate);
          setState("working");
          return;
        }
        setState("idle");
      } catch {
        if (!disposed) setState("error");
      }
      if (!disposed) timer = window.setTimeout(() => void findRun(), 15_000);
    };
    void findRun();
    return () => {
      disposed = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [activeRun]);

  useEffect(() => {
    if (!activeRun) return;
    let disposed = false;
    const observeRun = async () => {
      try {
        const response = await fetch(`/api/twitter-automation/automation-runs?scope=${activeRun.scope}&runId=${activeRun.id}`, { cache: "no-store" });
        const payload = await response.json() as { outputs?: ActiveOutput[] };
        const active = (payload.outputs ?? []).some((output) => output.run?.status === "queued" || output.run?.status === "processing" || output.run?.status === "ready_to_schedule");
        if (!disposed && !active) setActiveRun(null);
      } catch {
        // The queue discovery loop will retry after a transient network error.
      }
    };
    const timer = window.setInterval(() => void observeRun(), 15_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [activeRun]);

  if (activeRun) return <GeneratedPostsTable key={`${activeRun.scope}:${activeRun.id}`} onClose={() => { setActiveRun(null); setState("connecting"); }} runId={activeRun.id} scope={activeRun.scope} />;

  return <main className="grid min-h-screen place-items-center bg-[#101212] p-8 text-[#f7f3ed]">
    <div className="flex max-w-sm flex-col items-center gap-4 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border border-[#c7f05d]/35 bg-[#c7f05d]/10 text-[#c7f05d]"><MonitorCog className="size-7" /></div>
      <div><h1 className="font-serif text-2xl font-semibold">FoxiesDeck Renderer</h1><p className="mt-2 text-sm text-[#9aa9a0]">{state === "idle" ? "Kuyruk boş. Yeni batch bekleniyor." : state === "error" ? "Kuyruk bağlantısı yeniden deneniyor." : "Kalıcı render kuyruğuna bağlanılıyor."}</p></div>
      {state !== "idle" ? <LoaderCircle className="size-5 animate-spin text-[#c7f05d]" /> : null}
    </div>
  </main>;
}
