import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { fromMock, runInsertMock, outputInsertMock, stateMaybeSingleMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  runInsertMock: vi.fn(),
  outputInsertMock: vi.fn(),
  stateMaybeSingleMock: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-auth", () => ({
  hasSocialStudioSession: () => true,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: fromMock }),
}));

describe("automation run creation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("creates the selected quantity with independent random schedule times", async () => {
    const runRows: unknown[] = [];
    const createdOutputs: Array<{ scheduled_at: string; generator: string }> = [];
    stateMaybeSingleMock.mockResolvedValue({
      data: {
        groups: [{
          id: "47c65ced-6664-4cb8-9efd-fbb38de4f158",
          name: "Test campaign",
          rows: [{
            id: "a670283d-1d18-42d8-8463-7f19c280b5bb",
            contentType: "text",
            generator: "fun-post",
            contentTypes: ["text"],
            generators: { text: "fun-post" },
            randomIncludes: { text: ["ai"] },
            quantity: 5,
            language: "en",
            nativeLanguage: "tr",
            tier: "B1",
            accounts: { instagram: ["1"] },
            scheduleStart: "09:00",
            scheduleEnd: "18:00",
          }],
        }],
      },
      error: null,
    });
    runInsertMock.mockImplementation((row: unknown) => {
      runRows.push(row);
      return { select: () => ({ single: async () => ({ data: { id: "c77a7440-df76-4050-94c4-282118936152", horizon_days: 1, created_at: "2026-08-13T00:00:00Z" }, error: null }) }) };
    });
    outputInsertMock.mockImplementation((rows: Array<{ scheduled_at: string; generator: string }>) => {
      createdOutputs.push(...rows);
      return Promise.resolve({ error: null });
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_state") return { select: () => ({ eq: () => ({ maybeSingle: stateMaybeSingleMock }) }) };
      if (table === "social_content_automation_runs") return { insert: runInsertMock };
      if (table === "social_content_automation_outputs") return { insert: outputInsertMock };
      throw new Error(`Unexpected table: ${table}`);
    });
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0.99);

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs", {
      method: "POST",
      body: JSON.stringify({ horizonDays: 1 }),
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ outputCount: 5 });
    expect(runRows).toEqual([expect.objectContaining({ total_outputs: 5 })]);
    expect(createdOutputs).toHaveLength(5);
    expect(createdOutputs.every((output) => output.generator === "fun-post")).toBe(true);
    expect(new Set(createdOutputs.map((output) => output.scheduled_at)).size).toBe(5);
  });

  it("accepts the maximum quantity of twenty outputs", async () => {
    stateMaybeSingleMock.mockResolvedValue({
      data: {
        groups: {
          superGroups: [{ id: "a9cc2c75-5228-4cdb-bff5-8a0a8e5db7a5", name: "Video campaigns", icon: "video" }],
          groups: [{
          id: "47c65ced-6664-4cb8-9efd-fbb38de4f158",
          name: "Test campaign",
          superGroupId: "a9cc2c75-5228-4cdb-bff5-8a0a8e5db7a5",
          rows: [{
            id: "a670283d-1d18-42d8-8463-7f19c280b5bb",
            contentType: "text",
            generator: "fun-post",
            quantity: 20,
            language: "en",
            nativeLanguage: "tr",
            tier: "B1",
            accounts: { instagram: ["1"] },
            scheduleStart: "09:00",
            scheduleEnd: "18:00",
          }],
          }],
        },
      },
      error: null,
    });
    runInsertMock.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "c77a7440-df76-4050-94c4-282118936152", horizon_days: 1, created_at: "2026-08-13T00:00:00Z" }, error: null }) }) });
    outputInsertMock.mockResolvedValue({ error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_state") return { select: () => ({ eq: () => ({ maybeSingle: stateMaybeSingleMock }) }) };
      if (table === "social_content_automation_runs") return { insert: runInsertMock };
      if (table === "social_content_automation_outputs") return { insert: outputInsertMock };
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs", {
      method: "POST",
      body: JSON.stringify({ horizonDays: 1 }),
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ outputCount: 20 });
    expect(outputInsertMock).toHaveBeenCalledWith(expect.arrayContaining(Array(20).fill(expect.objectContaining({ generator: "fun-post" }))));
  });

  it("resolves random learning and native languages separately for each output", async () => {
    const createdOutputs: Array<{ language: string; native_language: string }> = [];
    stateMaybeSingleMock.mockResolvedValue({
      data: {
        groups: [{
          id: "47c65ced-6664-4cb8-9efd-fbb38de4f158",
          name: "Test campaign",
          rows: [{
            id: "a670283d-1d18-42d8-8463-7f19c280b5bb",
            contentType: "text",
            generator: "fun-post",
            quantity: 2,
            language: "random",
            nativeLanguage: "random",
            tier: "B1",
            accounts: { instagram: ["1"] },
            scheduleStart: "09:00",
            scheduleEnd: "18:00",
          }],
        }],
      },
      error: null,
    });
    runInsertMock.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "c77a7440-df76-4050-94c4-282118936152", horizon_days: 1, created_at: "2026-08-13T00:00:00Z" }, error: null }) }) });
    outputInsertMock.mockImplementation((outputs: Array<{ language: string; native_language: string }>) => {
      createdOutputs.push(...outputs);
      return Promise.resolve({ error: null });
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_state") return { select: () => ({ eq: () => ({ maybeSingle: stateMaybeSingleMock }) }) };
      if (table === "social_content_automation_runs") return { insert: runInsertMock };
      if (table === "social_content_automation_outputs") return { insert: outputInsertMock };
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs", {
      method: "POST",
      body: JSON.stringify({ horizonDays: 1 }),
    }));

    expect(response.status).toBe(201);
    expect(createdOutputs).toHaveLength(2);
    expect(createdOutputs.every((output) => output.language !== "random" && output.native_language !== "random")).toBe(true);
    expect(createdOutputs.every((output) => output.language !== output.native_language)).toBe(true);
  });

  it("skips hidden groups and groups inside hidden upper groups", async () => {
    const createdOutputs: Array<{ group_name: string }> = [];
    const hiddenSuperGroupId = "a9cc2c75-5228-4cdb-bff5-8a0a8e5db7a5";
    const row = (id: string) => ({
      id,
      contentType: "text",
      generator: "fun-post",
      quantity: 1,
      language: "en",
      nativeLanguage: "tr",
      tier: "B1",
      accounts: { instagram: ["1"] },
      scheduleStart: "09:00",
      scheduleEnd: "18:00",
    });
    stateMaybeSingleMock.mockResolvedValue({
      data: {
        groups: {
          superGroups: [{ id: hiddenSuperGroupId, name: "Paused videos", icon: "video", hidden: true }],
          groups: [
            { id: "47c65ced-6664-4cb8-9efd-fbb38de4f158", name: "Hidden campaign", hidden: true, rows: [row("a670283d-1d18-42d8-8463-7f19c280b5bb")] },
            { id: "a1bc2c75-5228-4cdb-bff5-8a0a8e5db7a5", name: "Paused video campaign", superGroupId: hiddenSuperGroupId, rows: [row("b670283d-1d18-42d8-8463-7f19c280b5bb")] },
            { id: "c1bc2c75-5228-4cdb-bff5-8a0a8e5db7a5", name: "Visible campaign", rows: [row("d670283d-1d18-42d8-8463-7f19c280b5bb")] },
          ],
        },
      },
      error: null,
    });
    runInsertMock.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: "c77a7440-df76-4050-94c4-282118936152", horizon_days: 1, created_at: "2026-08-13T00:00:00Z" }, error: null }) }) });
    outputInsertMock.mockImplementation((outputs: Array<{ group_name: string }>) => {
      createdOutputs.push(...outputs);
      return Promise.resolve({ error: null });
    });
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_state") return { select: () => ({ eq: () => ({ maybeSingle: stateMaybeSingleMock }) }) };
      if (table === "social_content_automation_runs") return { insert: runInsertMock };
      if (table === "social_content_automation_outputs") return { insert: outputInsertMock };
      throw new Error(`Unexpected table: ${table}`);
    });

    const response = await POST(new NextRequest("http://localhost/api/twitter-automation/automation-runs", {
      method: "POST",
      body: JSON.stringify({ horizonDays: 1 }),
    }));

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ outputCount: 1 });
    expect(createdOutputs).toEqual([expect.objectContaining({ group_name: "Visible campaign" })]);
  });
});
