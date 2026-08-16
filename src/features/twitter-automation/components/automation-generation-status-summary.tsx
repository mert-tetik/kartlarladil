import { Check, Clock3, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type AutomationGenerationStatusSummaryOutput = {
  error_code?: string | null;
  generator: string;
  status: string;
};

type GeneratorCount = {
  count: number;
  errorCodes: string[];
  generator: string;
};

type StatusDefinition = {
  id: "successful" | "failed" | "waiting";
  label: string;
  icon: LucideIcon;
  matches: (status: string) => boolean;
  buttonClassName: string;
  iconClassName: string;
  tooltipClassName: string;
};

const STATUS_DEFINITIONS: StatusDefinition[] = [
  {
    id: "successful",
    label: "Başarılı",
    icon: Check,
    matches: (status) => status === "ready_to_schedule" || status === "scheduled",
    buttonClassName: "border-[#3f8a62]/60 bg-[#173524] text-[#b6f0cf] hover:bg-[#1e472e] focus-visible:outline-[#a9ecc8]",
    iconClassName: "text-[#a9ecc8]",
    tooltipClassName: "border-[#3f8a62]/45 bg-[#13281c] text-[#d6f7e2]",
  },
  {
    id: "failed",
    label: "Hatalı",
    icon: X,
    matches: (status) => status === "failed",
    buttonClassName: "border-[#a94b56]/60 bg-[#3a2023] text-[#ffd0d5] hover:bg-[#4b292d] focus-visible:outline-[#ffb9c1]",
    iconClassName: "text-[#ffb9c1]",
    tooltipClassName: "border-[#a94b56]/45 bg-[#2c1917] text-[#ffd9de]",
  },
  {
    id: "waiting",
    label: "Bekleyen",
    icon: Clock3,
    matches: (status) => status !== "ready_to_schedule" && status !== "scheduled" && status !== "failed",
    buttonClassName: "border-[#b68e2c]/60 bg-[#322916] text-[#ffe7a0] hover:bg-[#40351e] focus-visible:outline-[#f1c75b]",
    iconClassName: "text-[#f1c75b]",
    tooltipClassName: "border-[#b68e2c]/45 bg-[#292214] text-[#ffeaac]",
  },
];

function generatorCounts(outputs: readonly AutomationGenerationStatusSummaryOutput[], definition: StatusDefinition) {
  const counts = new Map<string, { count: number; errorCodes: Set<string> }>();
  for (const output of outputs) {
    if (!definition.matches(output.status)) continue;
    const current = counts.get(output.generator) ?? { count: 0, errorCodes: new Set<string>() };
    current.count += 1;
    if (definition.id === "failed" && output.error_code) current.errorCodes.add(output.error_code);
    counts.set(output.generator, current);
  }
  return [...counts.entries()].map(([generator, { count, errorCodes }]): GeneratorCount => ({
    generator,
    count,
    errorCodes: [...errorCodes],
  }));
}

export function AutomationGenerationStatusSummary({ labelForGenerator, outputs }: {
  labelForGenerator: (generator: string) => string;
  outputs: readonly AutomationGenerationStatusSummaryOutput[];
}) {
  return <div aria-label="İçerik üretim özeti" className="mt-4 flex flex-wrap justify-center gap-2">
    {STATUS_DEFINITIONS.map((definition) => {
      const generators = generatorCounts(outputs, definition);
      const count = generators.reduce((total, item) => total + item.count, 0);
      const Icon = definition.icon;
      return <div className="group relative" key={definition.id}>
        <button aria-label={`${definition.label}: ${count} içerik`} className={cn("inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2", definition.buttonClassName)} type="button">
          <Icon aria-hidden="true" className={cn("size-3.5", definition.iconClassName)} />
          <span>{count}</span>
        </button>
        <div className={cn("pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded border p-2 text-left text-[11px] leading-4 opacity-0 shadow-sm transition-opacity duration-150 delay-500 group-hover:opacity-100 group-focus-within:opacity-100 group-focus-within:delay-0", definition.tooltipClassName)} role="tooltip">
          <p className="font-semibold">{definition.label} içerikler</p>
          {generators.length ? <ul className="mt-1.5 space-y-1.5">{generators.map(({ generator, count: generatorCount, errorCodes }) => <li className="flex items-start justify-between gap-3" key={generator}><div className="min-w-0"><p className="leading-4">{labelForGenerator(generator)}</p>{definition.id === "failed" && errorCodes.length ? <p className="mt-0.5 break-words text-current/75">Hata: {errorCodes.join(" · ")}</p> : null}</div><span className="shrink-0 font-semibold">{generatorCount} adet</span></li>)}</ul> : <p className="mt-1 text-current/75">Bu statüde içerik yok.</p>}
        </div>
      </div>;
    })}
  </div>;
}
