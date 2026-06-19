import { beforeEach, describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import type { InventoryCard, UserEntitlements } from "@/types/domain";
import {
  addCloudInventoryCardAction,
  listCloudInventoryAction,
  migrateLocalInventoryToCloudAction,
  recordCloudPracticeAttemptAction,
} from "@/features/inventory/cloud-actions";

const {
  mockRevalidatePath,
  mockGetUserEntitlements,
  mockCheckLimit,
} = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockGetUserEntitlements: vi.fn(),
  mockCheckLimit: vi.fn(),
}));

let currentSupabase: ReturnType<typeof createSupabaseMock>;

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/features/subscriptions/subscription-service", () => ({
  checkLimit: mockCheckLimit,
  getUserEntitlements: mockGetUserEntitlements,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve(currentSupabase)),
}));

interface UserCardRecord {
  user_id: string;
  card_source_key: string;
  status: string;
  correct_count: number;
  added_at: string;
  learned_at: string | null;
}

interface PracticeAttemptRecord {
  id: string;
  user_id: string;
  card_source_key: string;
  mode: string;
  selected_answer: string;
  correct_answer: string;
  is_correct: boolean;
  created_at: string;
}

interface MockState {
  userCards: UserCardRecord[];
  practiceAttempts: PracticeAttemptRecord[];
  nextAttemptId: number;
}

function createSupabaseMock(state: MockState, userId = "user-1") {
  class QueryBuilder {
    private filters: Array<{ field: string; value: unknown }> = [];
    private orderBy: { field: string; ascending: boolean } | null = null;
    private rowLimit: number | null = null;
    private selectOptions: { count?: string; head?: boolean } | undefined;
    private mode: "select" | "update" | "delete" = "select";
    private updateValues: Record<string, unknown> = {};

    constructor(private readonly table: "user_cards" | "practice_attempts") {}

    select(_columns: string, options?: { count?: string; head?: boolean }) {
      this.mode = "select";
      this.selectOptions = options;
      return this;
    }

    eq(field: string, value: unknown) {
      this.filters.push({ field, value });
      return this;
    }

    order(field: string, options: { ascending: boolean }) {
      this.orderBy = { field, ascending: options.ascending };
      return this;
    }

    limit(value: number) {
      this.rowLimit = value;
      return this;
    }

    maybeSingle<T>() {
      return Promise.resolve(this.asMaybeSingle<T>());
    }

    returns<T>() {
      return Promise.resolve(this.asSelect<T>());
    }

    update(values: Record<string, unknown>) {
      this.mode = "update";
      this.updateValues = values;
      return this;
    }

    delete() {
      this.mode = "delete";
      return this;
    }

    then<TResult1 = Awaited<unknown>, TResult2 = never>(
      onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return this.asAwaitable().then(onfulfilled, onrejected);
    }

    private asAwaitable() {
      if (this.mode === "update") {
        return Promise.resolve(this.applyUpdate());
      }

      if (this.mode === "delete") {
        return Promise.resolve(this.applyDelete());
      }

      return Promise.resolve(this.asSelect());
    }

    private asSelect<T = unknown>() {
      const rows = this.getRows();

      if (this.selectOptions?.head) {
        return {
          count: rows.length,
          data: null,
          error: null,
        };
      }

      return {
        data: clone(rows) as T,
        error: null,
      };
    }

    private asMaybeSingle<T>() {
      const rows = this.getRows();

      return {
        data: (rows[0] ?? null) as T | null,
        error: null,
      };
    }

    private applyUpdate() {
      const rows = this.getMutableRows();

      for (const row of rows) {
        Object.assign(row, this.updateValues);
      }

      return { data: null, error: null };
    }

    private applyDelete() {
      if (this.table === "user_cards") {
        const keep = state.userCards.filter((row) => !matchesFilters(row, this.filters));
        state.userCards = keep;
      } else {
        const keep = state.practiceAttempts.filter((row) => !matchesFilters(row, this.filters));
        state.practiceAttempts = keep;
      }

      return { data: null, error: null };
    }

    private getRows() {
      let rows = this.getMutableRows().map((row) => clone(row));

      if (this.orderBy) {
        const direction = this.orderBy.ascending ? 1 : -1;
        rows = rows.sort((left, right) => {
          const leftValue = String(left[this.orderBy!.field as keyof typeof left] ?? "");
          const rightValue = String(right[this.orderBy!.field as keyof typeof right] ?? "");
          return leftValue.localeCompare(rightValue) * direction;
        });
      }

      if (this.rowLimit !== null) {
        rows = rows.slice(0, this.rowLimit);
      }

      return rows;
    }

    private getMutableRows() {
      const rows = this.table === "user_cards" ? state.userCards : state.practiceAttempts;
      return rows.filter((row) => matchesFilters(row, this.filters));
    }
  }

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: userId } },
        error: null,
      })),
    },
    from(table: "user_cards" | "practice_attempts") {
      if (table === "user_cards") {
        return Object.assign(new QueryBuilder("user_cards"), {
          insert: async (value: Partial<UserCardRecord>) => {
            state.userCards.push({
              user_id: String(value.user_id),
              card_source_key: String(value.card_source_key),
              status: String(value.status ?? "active"),
              correct_count: Number(value.correct_count ?? 0),
              added_at: String(value.added_at ?? "2026-01-01T00:00:00.000Z"),
              learned_at: value.learned_at ? String(value.learned_at) : null,
            });

            return { error: null };
          },
          upsert: async (value: Partial<UserCardRecord> | Array<Partial<UserCardRecord>>, options?: { ignoreDuplicates?: boolean }) => {
            const rows = Array.isArray(value) ? value : [value];

            for (const row of rows) {
              const existing = state.userCards.find(
                (item) =>
                  item.user_id === String(row.user_id) &&
                  item.card_source_key === String(row.card_source_key),
              );

              if (existing) {
                if (options?.ignoreDuplicates) {
                  continue;
                }

                Object.assign(existing, {
                  status: String(row.status ?? existing.status),
                  correct_count: Number(row.correct_count ?? existing.correct_count),
                  added_at: String(row.added_at ?? existing.added_at),
                  learned_at:
                    row.learned_at === undefined
                      ? existing.learned_at
                      : row.learned_at
                        ? String(row.learned_at)
                        : null,
                });
                continue;
              }

              state.userCards.push({
                user_id: String(row.user_id),
                card_source_key: String(row.card_source_key),
                status: String(row.status ?? "active"),
                correct_count: Number(row.correct_count ?? 0),
                added_at: String(row.added_at ?? "2026-01-01T00:00:00.000Z"),
                learned_at: row.learned_at ? String(row.learned_at) : null,
              });
            }

            return { error: null };
          },
        });
      }

      return Object.assign(new QueryBuilder("practice_attempts"), {
        insert: async (value: Partial<PracticeAttemptRecord>) => {
          state.practiceAttempts.push({
            id: String(value.id ?? `attempt-${state.nextAttemptId++}`),
            user_id: String(value.user_id),
            card_source_key: String(value.card_source_key),
            mode: String(value.mode),
            selected_answer: String(value.selected_answer),
            correct_answer: String(value.correct_answer),
            is_correct: Boolean(value.is_correct),
            created_at: String(value.created_at ?? `2026-01-01T00:00:0${state.nextAttemptId}.000Z`),
          });

          return { error: null };
        },
      });
    },
  };
}

function matchesFilters(
  row: UserCardRecord | PracticeAttemptRecord,
  filters: Array<{ field: string; value: unknown }>,
) {
  return filters.every((filter) => row[filter.field as keyof typeof row] === filter.value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createState(overrides?: Partial<MockState>): MockState {
  return {
    userCards: [],
    practiceAttempts: [],
    nextAttemptId: 1,
    ...overrides,
  };
}

function createEntitlements(plan: UserEntitlements["effectivePlan"] = "basic"): UserEntitlements {
  return {
    plan,
    effectivePlan: plan,
    status: plan === "free" ? "free" : "active",
    customerPortalUrl: null,
    limits: {
      activeCards: plan === "free" ? 20 : null,
      learnedCards: plan === "free" ? 50 : null,
      aiDailyMessages: 10,
      aiMonthlyMessages: 200,
    },
  };
}

describe("cloud-actions", () => {
  const sampleCard = VOCABULARY_CARDS[0];

  beforeEach(() => {
    currentSupabase = createSupabaseMock(createState());
    mockRevalidatePath.mockReset();
    mockCheckLimit.mockReset();
    mockCheckLimit.mockReturnValue(null);
    mockGetUserEntitlements.mockReset();
    mockGetUserEntitlements.mockResolvedValue(createEntitlements("basic"));
  });

  it("rejects add requests for source keys missing from the local catalog", async () => {
    const result = await addCloudInventoryCardAction("missing-source-key");

    expect(result.status).toBe("error");
    expect(result.message).toContain("Kart yerel katalogda bulunamadı");
    expect(await listCloudInventoryAction()).toMatchObject({
      status: "success",
      data: {
        cards: [],
        attempts: [],
      },
    });
  });

  it("migrates local inventory directly with card_source_key rows", async () => {
    const state = createState();
    currentSupabase = createSupabaseMock(state);

    const localCards: InventoryCard[] = [
      {
        cardId: sampleCard.id,
        status: "active",
        correctCount: 2,
        addedAt: "2026-02-01T10:00:00.000Z",
      },
    ];

    const result = await migrateLocalInventoryToCloudAction(localCards);

    expect(result.status).toBe("success");
    expect(state.userCards).toEqual([
      {
        user_id: "user-1",
        card_source_key: sampleCard.sourceKey,
        status: "active",
        correct_count: 2,
        added_at: "2026-02-01T10:00:00.000Z",
        learned_at: null,
      },
    ]);
    expect(result.data?.cards).toEqual(localCards);
  });

  it("records practice attempts against an existing user_cards row by source key", async () => {
    const state = createState({
      userCards: [
        {
          user_id: "user-1",
          card_source_key: sampleCard.sourceKey,
          status: "active",
          correct_count: 1,
          added_at: "2026-02-01T10:00:00.000Z",
          learned_at: null,
        },
      ],
    });
    currentSupabase = createSupabaseMock(state);

    const result = await recordCloudPracticeAttemptAction({
      cardId: sampleCard.id,
      selectedAnswer: "sel",
      correctAnswer: "ok",
      isCorrect: true,
      mode: "active",
    });

    expect(result.status).toBe("success");
    expect(state.userCards[0]?.card_source_key).toBe(sampleCard.sourceKey);
    expect(state.userCards[0]?.correct_count).toBe(2);
    expect(state.practiceAttempts[0]).toMatchObject({
      user_id: "user-1",
      card_source_key: sampleCard.sourceKey,
      selected_answer: "sel",
      correct_answer: "ok",
      is_correct: true,
    });
    expect(result.data?.cards[0]?.cardId).toBe(sampleCard.sourceKey);
  });

  it("creates a missing user_cards row before writing the practice attempt", async () => {
    const state = createState();
    currentSupabase = createSupabaseMock(state);

    const result = await recordCloudPracticeAttemptAction({
      cardId: sampleCard.id,
      selectedAnswer: "sel",
      correctAnswer: "ok",
      isCorrect: false,
      mode: "active",
    });

    expect(result.status).toBe("success");
    expect(state.userCards).toHaveLength(1);
    expect(state.userCards[0]).toMatchObject({
      user_id: "user-1",
      card_source_key: sampleCard.sourceKey,
      correct_count: 0,
      status: "active",
    });
    expect(state.practiceAttempts).toHaveLength(1);
  });

  it("lists cloud inventory using card_source_key without catalog joins", async () => {
    const state = createState({
      userCards: [
        {
          user_id: "user-1",
          card_source_key: sampleCard.sourceKey,
          status: "learned",
          correct_count: 4,
          added_at: "2026-02-02T10:00:00.000Z",
          learned_at: "2026-02-03T10:00:00.000Z",
        },
      ],
      practiceAttempts: [
        {
          id: "attempt-9",
          user_id: "user-1",
          card_source_key: sampleCard.sourceKey,
          mode: "learned",
          selected_answer: "sel",
          correct_answer: "ok",
          is_correct: true,
          created_at: "2026-02-04T10:00:00.000Z",
        },
      ],
    });
    currentSupabase = createSupabaseMock(state);

    const result = await listCloudInventoryAction();

    expect(result).toEqual({
      status: "success",
      message: "",
      data: {
        cards: [
          {
            cardId: sampleCard.sourceKey,
            status: "learned",
            correctCount: 4,
            addedAt: "2026-02-02T10:00:00.000Z",
            learnedAt: "2026-02-03T10:00:00.000Z",
          },
        ],
        attempts: [
          {
            id: "attempt-9",
            cardId: sampleCard.sourceKey,
            selectedAnswer: "sel",
            correctAnswer: "ok",
            isCorrect: true,
            mode: "learned",
            createdAt: "2026-02-04T10:00:00.000Z",
          },
        ],
      },
    });
  });
});
