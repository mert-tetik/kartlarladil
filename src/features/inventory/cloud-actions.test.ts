// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VOCABULARY_CARDS } from "@/data/cards";
import { LOCALE_CODES } from "@/data/languages";
import { createCardTestLocaleRecord } from "@/test/card-locale-samples";
import type { InventoryCard, UserEntitlements } from "@/types/domain";
import {
  addCloudInventoryCardAction,
  addCloudInventoryCardsAction,
  createCustomCardAction,
  listCloudInventoryAction,
  migrateLocalInventoryToCloudAction,
  recordCloudPracticeAttemptAction,
} from "@/features/inventory/cloud-actions";

const {
  mockRevalidatePath,
  mockGetUserEntitlements,
  mockCheckLimit,
  mockCreateSupabaseAdminClient,
} = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
  mockGetUserEntitlements: vi.fn(),
  mockCheckLimit: vi.fn(),
  mockCreateSupabaseAdminClient: vi.fn(),
}));

const CARD_LANGUAGE_BY_SOURCE_KEY = new Map(
  VOCABULARY_CARDS.map((card) => [card.sourceKey, card.language]),
);

let currentSupabase: ReturnType<typeof createSupabaseMock>;

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/features/subscriptions/subscription-service", () => ({
  checkLimit: mockCheckLimit,
  getUserEntitlements: mockGetUserEntitlements,
}));

vi.mock("@/i18n/server", () => ({
  getServerLocale: vi.fn(async () => "tr"),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve(currentSupabase)),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient,
}));

interface UserCardRecord {
  user_id: string;
  card_source_key: string;
  language_code?: string;
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
  customCards: Array<Record<string, unknown>>;
  nextAttemptId: number;
  customCardInsertError?: unknown;
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

    in(field: string, values: unknown[]) {
      this.filters.push({ field, value: { __in: values } });
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
    rpc(name: string, args: { p_source_keys?: string[]; p_active_card_limit?: number | null }) {
      if (name !== "add_user_cards_with_active_limit") {
        return Promise.resolve({ data: null, error: new Error(`Unexpected RPC: ${name}`) });
      }

      const requestedKeys = [...new Set((args.p_source_keys ?? []).filter((key) => key.trim().length > 0))];
      const existingKeys = new Set(
        state.userCards
          .filter((row) => row.user_id === userId)
          .map((row) => row.card_source_key),
      );
      const newKeys = requestedKeys.filter((key) => !existingKeys.has(key));
      const languageFor = (sourceKey: string): string | undefined => {
        const customLanguage = state.customCards.find((card) => card.source_key === sourceKey)?.language;
        return CARD_LANGUAGE_BY_SOURCE_KEY.get(sourceKey)
          ?? (typeof customLanguage === "string" ? customLanguage : undefined);
      };
      const activeCounts = new Map<string, number>();
      for (const row of state.userCards) {
        if (row.user_id !== userId || row.status !== "active") continue;
        const language = languageFor(row.card_source_key);
        if (language) activeCounts.set(language, (activeCounts.get(language) ?? 0) + 1);
      }
      const addedCardIds: string[] = [];
      const remainingCardIds: string[] = [];
      for (const sourceKey of newKeys) {
        const language = languageFor(sourceKey);
        const activeCount = language ? activeCounts.get(language) ?? 0 : 0;
        if (
          !language ||
          (args.p_active_card_limit !== null && args.p_active_card_limit !== undefined && activeCount >= args.p_active_card_limit)
        ) {
          remainingCardIds.push(sourceKey);
          continue;
        }

        addedCardIds.push(sourceKey);
        activeCounts.set(language, activeCount + 1);
      }

      state.userCards.push(
        ...addedCardIds.map((cardSourceKey) => ({
          user_id: userId,
          card_source_key: cardSourceKey,
          status: "active",
          correct_count: 0,
          added_at: "2026-01-01T00:00:00.000Z",
          learned_at: null,
        })),
      );

      return Promise.resolve({
        data: { added_card_ids: addedCardIds, remaining_card_ids: remainingCardIds },
        error: null,
      });
    },
    from(table: "user_cards" | "practice_attempts" | "custom_cards") {
      if (table === "custom_cards") {
        const filters: Array<{ field: string; value: unknown }> = [];
        let deleteMode = false;
        const builder = {
          select() { return builder; },
          eq(field: string, value: unknown) {
            filters.push({ field, value });
            return builder;
          },
          maybeSingle<T>() {
            const row = state.customCards.find((candidate) => filters.every((filter) => candidate[filter.field] === filter.value));
            return Promise.resolve({ data: (row ? clone(row) : null) as T | null, error: null });
          },
          async insert(value: Record<string, unknown>) {
            if (state.customCardInsertError) return { error: state.customCardInsertError };
            state.customCards.push({ ...clone(value), id: `custom-row-${state.customCards.length + 1}`, created_at: "2026-01-01T00:00:00.000Z" });
            return { error: null };
          },
          delete() {
            deleteMode = true;
            return builder;
          },
          then<TResult1 = { data: null; error: null }, TResult2 = never>(
            onfulfilled?: ((value: { data: null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
            onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
          ) {
            if (deleteMode) {
              state.customCards = state.customCards.filter((candidate) => !filters.every((filter) => candidate[filter.field] === filter.value));
            }
            return Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected);
          },
        };
        return builder;
      }

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
  return filters.every((filter) => {
    const rowValue = row[filter.field as keyof typeof row];
    if (typeof filter.value === "object" && filter.value !== null && "__in" in filter.value) {
      return (filter.value.__in as unknown[]).includes(rowValue);
    }

    return rowValue === filter.value;
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createState(overrides?: Partial<MockState>): MockState {
  return {
    userCards: [],
    practiceAttempts: [],
    customCards: [],
    nextAttemptId: 1,
    customCardInsertError: undefined,
    ...overrides,
  };
}

function createEntitlements(plan: UserEntitlements["effectivePlan"] = "basic"): UserEntitlements {
  return {
    plan,
    effectivePlan: plan,
    status: plan === "free" ? "free" : "active",
    provider: "google_play",
    customerPortalUrl: null,
    endsAt: plan === "free" ? null : "2099-01-01T00:00:00.000Z",
    limits: {
      activeCards: plan === "free" ? 20 : null,
      learnedCards: plan === "free" ? 100 : null,
      aiDailyMessages: 10,
      aiMonthlyMessages: 200,
    },
  };
}

describe("cloud-actions", () => {
  const sampleCard = VOCABULARY_CARDS[0];

  beforeEach(() => {
    currentSupabase = createSupabaseMock(createState());
    mockCreateSupabaseAdminClient.mockReset();
    mockCreateSupabaseAdminClient.mockImplementation(() => currentSupabase);
    mockRevalidatePath.mockReset();
    mockCheckLimit.mockReset();
    mockCheckLimit.mockReturnValue(null);
    mockGetUserEntitlements.mockReset();
    mockGetUserEntitlements.mockResolvedValue(createEntitlements("basic"));
  });

  it("rejects add requests for source keys missing from the local catalog", async () => {
    const result = await addCloudInventoryCardAction("missing-source-key");

    expect(result.status).toBe("error");
    expect(result.message).toContain("Kart bilgisi yerel katalogda bulunamadı");
    expect(await listCloudInventoryAction()).toMatchObject({
      status: "success",
      data: {
        cards: [],
        attempts: [],
      },
    });
  });

  it("adds a batch without duplicates and stops at the free active-card limit", async () => {
    const existingCards = VOCABULARY_CARDS.slice(0, 19);
    const requestedCards = VOCABULARY_CARDS.slice(18, 22);
    const state = createState({
      userCards: existingCards.map((card) => ({
        user_id: "user-1",
        card_source_key: card.sourceKey,
        status: "active",
        correct_count: 0,
        added_at: "2026-01-01T00:00:00.000Z",
        learned_at: null,
      })),
    });
    currentSupabase = createSupabaseMock(state);
    mockGetUserEntitlements.mockResolvedValue(createEntitlements("free"));

    const result = await addCloudInventoryCardsAction(requestedCards.map((card) => card.sourceKey));

    expect(result.status).toBe("success");
    expect(result.data?.addedCardIds).toEqual([VOCABULARY_CARDS[19]?.sourceKey]);
    expect(result.data?.remainingCardIds).toEqual([
      VOCABULARY_CARDS[20]?.sourceKey,
      VOCABULARY_CARDS[21]?.sourceKey,
    ]);
    expect(state.userCards).toHaveLength(20);
  });

  it("adds exactly the available twenty cards from a twenty-five-card Free batch", async () => {
    currentSupabase = createSupabaseMock(createState());
    mockGetUserEntitlements.mockResolvedValue(createEntitlements("free"));

    const requestedCards = VOCABULARY_CARDS.slice(0, 25);
    const result = await addCloudInventoryCardsAction(requestedCards.map((card) => card.sourceKey));

    expect(result.status).toBe("success");
    expect(result.data?.addedCardIds).toHaveLength(20);
    expect(result.data?.remainingCardIds).toEqual(
      requestedCards.slice(20).map((card) => card.sourceKey),
    );
    expect(result.data?.cards.filter((card) => card.status === "active")).toHaveLength(20);
  });

  it("gives each learning language its own twenty-card Free limit", async () => {
    const englishCards = VOCABULARY_CARDS.filter((card) => card.language === "en").slice(0, 20);
    const germanCard = VOCABULARY_CARDS.find((card) => card.language === "de")!;
    const state = createState({
      userCards: englishCards.map((card) => ({
        user_id: "user-1",
        card_source_key: card.sourceKey,
        status: "active",
        correct_count: 0,
        added_at: "2026-01-01T00:00:00.000Z",
        learned_at: null,
      })),
    });
    currentSupabase = createSupabaseMock(state);
    mockGetUserEntitlements.mockResolvedValue(createEntitlements("free"));

    const result = await addCloudInventoryCardsAction([germanCard.sourceKey]);

    expect(result.status).toBe("success");
    expect(result.data?.addedCardIds).toEqual([germanCard.sourceKey]);
    expect(result.data?.remainingCardIds).toEqual([]);
    expect(state.userCards).toHaveLength(21);
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

  it("migrates cards when another language is already at its Free active-card limit", async () => {
    const englishCards = VOCABULARY_CARDS.filter((card) => card.language === "en").slice(0, 20);
    const germanCard = VOCABULARY_CARDS.find((card) => card.language === "de")!;
    const state = createState({
      userCards: englishCards.map((card) => ({
        user_id: "user-1",
        card_source_key: card.sourceKey,
        language_code: card.language,
        status: "active",
        correct_count: 0,
        added_at: "2026-01-01T00:00:00.000Z",
        learned_at: null,
      })),
    });
    currentSupabase = createSupabaseMock(state);
    mockGetUserEntitlements.mockResolvedValue(createEntitlements("free"));

    const result = await migrateLocalInventoryToCloudAction([{
      cardId: germanCard.sourceKey,
      status: "active",
      correctCount: 0,
      addedAt: "2026-02-01T10:00:00.000Z",
    }]);

    expect(result.status).toBe("success");
    expect(state.userCards).toHaveLength(21);
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

  it("blocks Free users from recording learned-card review attempts server-side", async () => {
    const learnedCard: UserCardRecord = {
      user_id: "user-1",
      card_source_key: sampleCard.sourceKey,
      status: "learned",
      correct_count: 4,
      added_at: "2026-02-01T10:00:00.000Z",
      learned_at: "2026-02-03T10:00:00.000Z",
    };
    const state = createState({ userCards: [learnedCard] });
    currentSupabase = createSupabaseMock(state);
    mockGetUserEntitlements.mockResolvedValue(createEntitlements("free"));

    const result = await recordCloudPracticeAttemptAction({
      cardId: sampleCard.id,
      selectedAnswer: "sel",
      correctAnswer: "ok",
      isCorrect: true,
      mode: "learned",
    });

    expect(result).toMatchObject({
      status: "error",
      errorCode: "learned_review_subscription_required",
    });
    expect(state.userCards).toEqual([learnedCard]);
    expect(state.practiceAttempts).toHaveLength(0);
  });

  it("allows paid users to record learned-card review attempts", async () => {
    const learnedCard: UserCardRecord = {
      user_id: "user-1",
      card_source_key: sampleCard.sourceKey,
      status: "learned",
      correct_count: 4,
      added_at: "2026-02-01T10:00:00.000Z",
      learned_at: "2026-02-03T10:00:00.000Z",
    };
    const state = createState({ userCards: [learnedCard] });
    currentSupabase = createSupabaseMock(state);

    const result = await recordCloudPracticeAttemptAction({
      cardId: sampleCard.id,
      selectedAnswer: "sel",
      correctAnswer: "ok",
      isCorrect: true,
      mode: "learned",
    });

    expect(result.status).toBe("success");
    expect(state.practiceAttempts).toHaveLength(1);
    expect(state.practiceAttempts[0]?.mode).toBe("learned");
    expect(state.userCards[0]).toEqual(learnedCard);
  });

  it("rejects a practice attempt for a card that is not in the user's inventory", async () => {
    const state = createState();
    currentSupabase = createSupabaseMock(state);

    const result = await recordCloudPracticeAttemptAction({
      cardId: sampleCard.id,
      selectedAnswer: "sel",
      correctAnswer: "ok",
      isCorrect: false,
      mode: "active",
    });

    expect(result.status).toBe("error");
    expect(state.userCards).toHaveLength(0);
    expect(state.practiceAttempts).toHaveLength(0);
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

  it("rejects drafts without two distinct examples before writing anything", async () => {
    const state = createState();
    currentSupabase = createSupabaseMock(state);

    const result = await createCustomCardAction({
      language: "en",
      tier: "A1",
      termKind: "word",
      draft: {
        term: "custom",
        partOfSpeech: "noun",
        pronunciation: "kustom",
        translations: createCardTestLocaleRecord(),
        examples: [
          { example: "This is a custom card.", translation: "Bu özel bir kart." },
          { example: "This is a custom card!", translation: "Bu özel bir kart." },
        ],
        definitions: createCardTestLocaleRecord(),
        grammar: [],
        termKind: "word",
      },
    });

    expect(result.status).toBe("error");
    expect(result.message).toBeTruthy();
    expect(state.userCards).toHaveLength(0);
    expect(mockCreateSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns the system error message when custom card creation fails", async () => {
    const state = createState({
      customCardInsertError: {
        message: "new row violates row-level security policy for table custom_cards",
        details: "Failing row contains user_id user-1.",
        hint: "Check custom_cards insert policy.",
        code: "42501",
      },
    });
    currentSupabase = createSupabaseMock(state);

    const result = await createCustomCardAction({
      language: "en",
      tier: "A1",
      termKind: "word",
      draft: {
        term: "custom",
        partOfSpeech: "noun",
        pronunciation: "kustom",
        translations: createCardTestLocaleRecord(),
        examples: [
          { example: "This is a custom card.", translation: "Bu özel bir kart." },
          { example: "We created a custom design.", translation: "Özel bir tasarım oluşturduk." },
        ],
        definitions: createCardTestLocaleRecord(),
        grammar: ["Used as a noun."],
        termKind: "word",
      },
    });

    expect(result.status).toBe("error");
    expect(result.message).toContain("new row violates row-level security policy");
    expect(result.message).toContain("Details: Failing row contains user_id user-1.");
    expect(result.message).toContain("Hint: Check custom_cards insert policy.");
    expect(result.message).toContain("Code: 42501");
  });

  it("returns the created custom vocabulary card without reloading custom cards", async () => {
    const state = createState();
    currentSupabase = createSupabaseMock(state);

    const result = await createCustomCardAction({
      language: "de",
      tier: "A2",
      termKind: "word",
      draft: {
        term: "custom",
        partOfSpeech: "noun",
        pronunciation: "kustom",
        translations: createCardTestLocaleRecord(),
        examples: [
          { example: "Das ist eine Sonderanfertigung.", translation: "This is custom-made." },
          { example: "Wir haben das Design angepasst.", translation: "We customized the design." },
        ],
        definitions: createCardTestLocaleRecord(),
        grammar: ["Used as a custom card."],
        termKind: "word",
      },
    });

    expect(result.status).toBe("success");
    expect(result.data?.card.cardId).toMatch(/^custom:user-1:/);
    expect(result.data?.card.status).toBe("active");
    expect(result.data?.vocabularyCard.sourceKey).toBe(result.data?.card.cardId);
    expect(result.data?.vocabularyCard.language).toBe("de");
    expect(result.data?.vocabularyCard.term).toBe("custom");
    expect(result.data?.vocabularyCard.examples).toHaveLength(2);
    expect(result.data?.vocabularyCard.definitionsByLocale).toMatchObject(
      Object.fromEntries(LOCALE_CODES.map((code) => [code, expect.any(String)])),
    );
    expect(state.userCards).toHaveLength(1);
    expect(state.userCards[0]?.card_source_key).toBe(result.data?.card.cardId);
  });

  it("makes offline queued custom-card creation idempotent across retries", async () => {
    const state = createState();
    currentSupabase = createSupabaseMock(state);
    const input = {
      language: "de" as const,
      tier: "A2" as const,
      termKind: "word" as const,
      idempotencyKey: "offline-draft-123",
      draft: {
        term: "Wanderlust",
        partOfSpeech: "noun",
        pronunciation: "vanderlust",
        translations: createCardTestLocaleRecord(),
        examples: [
          { example: "Die Wanderlust packte sie.", translation: "The desire to travel seized her." },
          { example: "Seine Wanderlust führte ihn nach Japan.", translation: "His wanderlust took him to Japan." },
        ],
        definitions: createCardTestLocaleRecord(),
        grammar: ["Used as a noun."],
        termKind: "word" as const,
      },
    };

    const first = await createCustomCardAction(input);
    const retry = await createCustomCardAction(input);

    expect(first.status).toBe("success");
    expect(retry.status).toBe("success");
    expect(retry.data?.card.cardId).toBe("custom:user-1:offline:offline-draft-123");
    expect(state.customCards).toHaveLength(1);
    expect(state.userCards).toHaveLength(1);
  });
});
