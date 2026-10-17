import { AUTOMATION_CONTENT_TYPES, type AutomationContentType } from "@/features/twitter-automation/automation-randomization";

export type DailyQuantities = Record<AutomationContentType, number>;

export type LanguageCombinationPlanningRow = {
  contentType?: "random" | AutomationContentType;
  contentTypes?: readonly AutomationContentType[];
  quantity: number;
  accounts: Record<string, readonly string[]>;
  dailyQuantities?: Partial<DailyQuantities>;
  accountContentTypes?: Record<string, readonly AutomationContentType[]>;
};

export type LanguageCombinationPlanSource<TGroup, TRow extends LanguageCombinationPlanningRow> = {
  group: TGroup;
  row: TRow;
};

export type LanguageCombinationPlanItem<TGroup, TRow extends LanguageCombinationPlanningRow> = {
  group: TGroup;
  row: TRow;
  contentType: AutomationContentType;
  quantity: number;
  targetIds: string[];
};

export function normalizeDailyQuantities(value: Partial<DailyQuantities> | undefined, fallback = 0): DailyQuantities {
  return Object.fromEntries(AUTOMATION_CONTENT_TYPES.map((contentType) => [
    contentType,
    Number.isInteger(value?.[contentType]) ? Math.max(0, Math.min(20, value?.[contentType] ?? fallback)) : fallback,
  ])) as DailyQuantities;
}

export function activeLanguageCombinationContentTypes(row: LanguageCombinationPlanningRow) {
  if (row.dailyQuantities) {
    return AUTOMATION_CONTENT_TYPES.filter((contentType) => (row.dailyQuantities?.[contentType] ?? 0) > 0);
  }
  if (row.contentTypes?.length) return [...new Set(row.contentTypes)];
  if (row.contentType && row.contentType !== "random") return [row.contentType];
  return [...AUTOMATION_CONTENT_TYPES];
}

export function languageCombinationQuantity(row: LanguageCombinationPlanningRow, contentType: AutomationContentType) {
  if (row.dailyQuantities) return Math.max(0, Math.min(20, row.dailyQuantities[contentType] ?? 0));
  return activeLanguageCombinationContentTypes(row).includes(contentType) ? Math.max(0, row.quantity) : 0;
}

export function languageCombinationAccountIds(row: LanguageCombinationPlanningRow) {
  return [...new Set(Object.values(row.accounts).flat())];
}

export function languageCombinationTargetIds(row: LanguageCombinationPlanningRow, contentType: AutomationContentType) {
  const accountIds = languageCombinationAccountIds(row);
  if (!row.accountContentTypes) return accountIds;
  return accountIds.filter((accountId) => row.accountContentTypes?.[accountId]?.includes(contentType));
}

export function buildLanguageCombinationPlan<TGroup, TRow extends LanguageCombinationPlanningRow>(sources: readonly LanguageCombinationPlanSource<TGroup, TRow>[]) {
  return sources.flatMap(({ group, row }) => activeLanguageCombinationContentTypes(row).flatMap((contentType) => {
    const quantity = languageCombinationQuantity(row, contentType);
    const targetIds = languageCombinationTargetIds(row, contentType);
    return quantity > 0 && targetIds.length ? [{ group, row, contentType, quantity, targetIds }] : [];
  })) satisfies LanguageCombinationPlanItem<TGroup, TRow>[];
}
