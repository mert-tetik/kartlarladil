import "server-only";

import crypto from "node:crypto";

export type DailyAutomationOutputIdentity = {
  id: string;
  generationKey: string;
};

export type DailyAutomationOutputMetadata = {
  generationKey: string;
  generationDate: string;
  generationIndex: number;
  title: string;
  description: string | null;
};

const DAILY_OUTPUT_METADATA_KEY = "__foxiesdeckDailyOutput";

function deterministicUuid(seed: string) {
  const bytes = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  bytes[12] = "5";
  bytes[16] = (Number.parseInt(bytes[16]!, 16) & 0x3 | 0x8).toString(16);
  return [
    bytes.slice(0, 8).join(""),
    bytes.slice(8, 12).join(""),
    bytes.slice(12, 16).join(""),
    bytes.slice(16, 20).join(""),
    bytes.slice(20, 32).join(""),
  ].join("-");
}

/**
 * The identity intentionally does not contain a random schedule time or a
 * generator choice. The output slot belongs to the Istanbul calendar day and
 * language-combination pool, so rerunning the same daily plan reuses it.
 */
export function createDailyAutomationOutputIdentity(input: {
  ownerKey: string;
  generationDate: string;
  combinationId: string;
  contentType: "text" | "image" | "video";
  generationIndex: number;
}): DailyAutomationOutputIdentity {
  const generationKey = [
    "foxiesdeck-daily-v1",
    input.ownerKey,
    input.generationDate,
    input.combinationId,
    input.contentType,
    String(input.generationIndex),
  ].join(":");

  return {
    id: deterministicUuid(generationKey),
    generationKey,
  };
}

/**
 * A generated slot belongs to one explicit bulk run, not to a calendar day.
 * Replaying the same creation request therefore reuses its output ids, while a
 * separately started run always gets an independent set of outputs.
 */
export function createRunAutomationOutputIdentity(input: {
  runId: string;
  slotKey: string;
}): DailyAutomationOutputIdentity {
  const generationKey = ["foxiesdeck-run-v1", input.runId, input.slotKey].join(":");
  return {
    id: deterministicUuid(generationKey),
    generationKey,
  };
}

export function createDailyAutomationOutputMetadata(input: DailyAutomationOutputMetadata) {
  return {
    [DAILY_OUTPUT_METADATA_KEY]: {
      generationKey: input.generationKey,
      generationDate: input.generationDate,
      generationIndex: input.generationIndex,
      title: input.title,
      description: input.description,
    } satisfies DailyAutomationOutputMetadata,
  };
}

export function readDailyAutomationOutputMetadata(value: unknown): DailyAutomationOutputMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = (value as Record<string, unknown>)[DAILY_OUTPUT_METADATA_KEY];
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  if (
    typeof record.generationKey !== "string" ||
    typeof record.generationDate !== "string" ||
    typeof record.generationIndex !== "number" ||
    !Number.isInteger(record.generationIndex) ||
    record.generationIndex < 1 ||
    typeof record.title !== "string"
  ) return null;
  return {
    generationKey: record.generationKey,
    generationDate: record.generationDate,
    generationIndex: record.generationIndex,
    title: record.title,
    description: typeof record.description === "string" ? record.description : null,
  };
}

export function mergeDailyAutomationOutputMetadata(value: unknown, metadata: DailyAutomationOutputMetadata) {
  const base = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    ...base,
    ...createDailyAutomationOutputMetadata(metadata),
  };
}
