type SharedPoolRow = {
  contentType?: "random" | "text" | "image" | "video";
  contentTypes?: readonly ("text" | "image" | "video")[];
  generators?: Partial<Record<"text" | "image" | "video", string>>;
  generator: string;
  randomIncludes?: Partial<Record<"text" | "image" | "video", readonly string[]>>;
  quantity: number;
  language: string;
  nativeLanguage: string;
  tier: string;
  scheduleStart: string;
  scheduleEnd: string;
};

export type SharedPoolSource<TGroup, TRow extends SharedPoolRow> = {
  group: TGroup;
  row: TRow;
  targetIds: number[];
};

export type SharedPoolPlan<TGroup, TRow extends SharedPoolRow> = {
  group: TGroup;
  row: TRow;
  targetIdsByOutput: number[][];
};

function resolvedContentTypes(row: SharedPoolRow) {
  if (row.contentTypes?.length) return [...new Set(row.contentTypes)].sort();
  if (row.contentType === "text" || row.contentType === "image" || row.contentType === "video") return [row.contentType];
  return ["text", "image", "video"] as const;
}

/**
 * Rows with an identical generation recipe can share generated media. The
 * platform/account targets are intentionally excluded from this key.
 */
export function sharedPoolRecipeKey(row: SharedPoolRow) {
  const contentTypes = resolvedContentTypes(row);
  return JSON.stringify({
    contentTypes,
    generators: contentTypes.map((contentType) => [contentType, row.generators?.[contentType] ?? (contentTypes.length === 1 ? row.generator : "random")]),
    randomIncludes: contentTypes.map((contentType) => [contentType, [...(row.randomIncludes?.[contentType] ?? [])].sort()]),
    language: row.language,
    nativeLanguage: row.nativeLanguage,
    tier: row.tier,
    scheduleStart: row.scheduleStart,
    scheduleEnd: row.scheduleEnd,
  });
}

/**
 * Builds the minimum production pool while preserving each platform's daily
 * quantity. For a shared recipe, the first N outputs target every platform
 * that requested at least N outputs; no platform loses its requested count.
 */
export function buildSharedPoolPlan<TGroup, TRow extends SharedPoolRow>(sources: readonly SharedPoolSource<TGroup, TRow>[]) {
  const pools = new Map<string, SharedPoolSource<TGroup, TRow>[]>();
  for (const source of sources) {
    const key = sharedPoolRecipeKey(source.row);
    pools.set(key, [...(pools.get(key) ?? []), source]);
  }

  return [...pools.values()].map((pool) => {
    const first = pool[0]!;
    const quantity = Math.max(...pool.map((source) => source.row.quantity));
    const targetIdsByOutput = Array.from({ length: quantity }, (_, outputIndex) => [...new Set(
      pool
        .filter((source) => source.row.quantity > outputIndex)
        .flatMap((source) => source.targetIds),
    )]);

    return {
      group: first.group,
      row: { ...first.row, quantity },
      targetIdsByOutput,
    } satisfies SharedPoolPlan<TGroup, TRow>;
  });
}
