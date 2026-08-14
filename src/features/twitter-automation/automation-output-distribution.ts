import { AUTOMATION_GENERATOR_OPTIONS, RANDOM_GENERATOR, isRandomGenerator, randomGeneratorsFor, resolveRandomIncludes, type AutomationContentType, type AutomationGeneratorSource, type RandomIncludes } from "@/features/twitter-automation/automation-randomization";

export type AutomationOutputEstimateRow = {
  contentType: "random" | "text" | "image" | "video";
  generator: string;
  contentTypes?: AutomationContentType[];
  generators?: Partial<Record<AutomationContentType, string>>;
  randomIncludes?: RandomIncludes;
  quantity?: number;
};

export type AutomationOutputDistributionEntry = {
  contentType: AutomationContentType;
  generator: string;
  source: AutomationGeneratorSource | null;
  probability: number;
  expectedOutputs: number;
};

export type AutomationOutputDistribution = {
  entries: AutomationOutputDistributionEntry[];
  totalOutputs: number;
  expectedByContentType: Record<AutomationContentType, number>;
  expectedBySource: Record<AutomationGeneratorSource, number>;
};

const CONTENT_TYPES = ["text", "image", "video"] as const;
const SOURCES = ["AI", "SELF", "IMG"] as const;

function selectedContentTypes(row: AutomationOutputEstimateRow): AutomationContentType[] {
  const explicitlySelected = row.contentTypes?.filter((contentType): contentType is AutomationContentType => CONTENT_TYPES.includes(contentType));
  if (explicitlySelected?.length) return [...new Set(explicitlySelected)];
  if (row.contentType === "text" || row.contentType === "image" || row.contentType === "video") return [row.contentType];
  return [...CONTENT_TYPES];
}

function generatorSource(contentType: AutomationContentType, generator: string) {
  return AUTOMATION_GENERATOR_OPTIONS[contentType].find((option) => option.value === generator)?.source ?? null;
}

function generatorsForRowContentType(row: AutomationOutputEstimateRow, contentType: AutomationContentType) {
  const generator = row.generators?.[contentType] ?? (row.contentType === contentType ? row.generator : RANDOM_GENERATOR);
  if (!isRandomGenerator(generator)) return [generator];
  return randomGeneratorsFor(contentType, resolveRandomIncludes(contentType, generator, row.randomIncludes?.[contentType]));
}

export function distributeAutomationRowOutputs(row: AutomationOutputEstimateRow): AutomationOutputDistributionEntry[] {
  const contentTypes = selectedContentTypes(row);
  const quantity = Number.isInteger(row.quantity) ? Math.max(1, row.quantity!) : 1;
  const contentTypeProbability = 1 / contentTypes.length;

  return contentTypes.flatMap((contentType) => {
    const generators = generatorsForRowContentType(row, contentType);
    if (!generators.length) return [];
    const probability = contentTypeProbability / generators.length;
    return generators.map((generator) => ({
      contentType,
      generator,
      source: generatorSource(contentType, generator),
      probability,
      expectedOutputs: quantity * probability,
    }));
  });
}

export function estimateAutomationOutputDistribution(rows: readonly AutomationOutputEstimateRow[]): AutomationOutputDistribution {
  const entries = rows.flatMap(distributeAutomationRowOutputs);
  const expectedByContentType: Record<AutomationContentType, number> = { text: 0, image: 0, video: 0 };
  const expectedBySource: Record<AutomationGeneratorSource, number> = { AI: 0, SELF: 0, IMG: 0 };

  for (const entry of entries) {
    expectedByContentType[entry.contentType] += entry.expectedOutputs;
    if (entry.source) expectedBySource[entry.source] += entry.expectedOutputs;
  }

  return {
    entries,
    totalOutputs: entries.reduce((total, entry) => total + entry.expectedOutputs, 0),
    expectedByContentType,
    expectedBySource,
  };
}

function formatExpectedOutputCount(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);
}

export function describeExpectedOutputSourceMix(distribution: AutomationOutputDistribution) {
  const parts = SOURCES
    .filter((source) => distribution.expectedBySource[source] > 0)
    .map((source) => `${source} ${formatExpectedOutputCount(distribution.expectedBySource[source])}`);
  return parts.length ? parts.join(" · ") : "No generator selected";
}
