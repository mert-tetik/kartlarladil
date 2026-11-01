import { describe, expect, it, vi } from "vitest";
import { cleanupAllAutomationRunData } from "@/features/twitter-automation/automation-maintenance-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const blobMocks = vi.hoisted(() => ({
  listSocialStudioBlobPathnames: vi.fn(),
  deleteSocialStudioBlobs: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-blob", () => blobMocks);

function makeSupabaseMock(initialPaths: string[]) {
  const files = new Set(initialPaths);
  const rowCounts = { runs: 4, outputs: 11 };
  let activeSchedules: Array<{ id: string; schedule_status: string; schedule_error_code: string | null; schedule_attempted_at: string | null }> = [];
  let listFailure = false;
  const deleteRunRows = vi.fn(async () => {
    rowCounts.runs = 0;
    rowCounts.outputs = 0;
    return { error: null };
  });
  const remove = vi.fn(async (paths: string[]) => {
    for (const path of paths) files.delete(path);
    return undefined;
  });
  blobMocks.listSocialStudioBlobPathnames.mockImplementation(async () => {
    if (listFailure) throw new Error("storage unavailable");
    return [...files].filter((path) => path.startsWith("automation/"));
  });
  blobMocks.deleteSocialStudioBlobs.mockImplementation(remove);

  const client = {
    from: (table: string) => ({
      select: (_columns: string, options?: { count?: string; head?: boolean }) => {
        if (options?.head) {
          return Promise.resolve({
            count: table === "social_content_automation_runs" ? rowCounts.runs : rowCounts.outputs,
            error: null,
          });
        }
        const query = {
          eq: () => query,
          range: () => query,
          returns: async () => ({ data: activeSchedules, error: null }),
        };
        return query;
      },
      delete: () => ({ not: deleteRunRows }),
    }),
  };

  return {
    client,
    files,
    list: blobMocks.listSocialStudioBlobPathnames,
    remove,
    deleteRunRows,
    setListFailure: (value: boolean) => { listFailure = value; },
    setActiveSchedules: (value: typeof activeSchedules) => { activeSchedules = value; },
  };
}

describe("cleanupAllAutomationRunData", () => {
  it("deletes nested and root media, then clears run rows and cascading outputs", async () => {
    const mock = makeSupabaseMock([
      "automation/one.webp",
      "automation/nested/two.mp4",
      "root-orphan.png",
    ]);

    const result = await cleanupAllAutomationRunData(mock.client as unknown as ReturnType<typeof createSupabaseAdminClient>);

    expect(result).toEqual({ deletedRuns: 4, deletedOutputs: 11, removedMedia: 2 });
    expect(mock.files).toEqual(new Set(["root-orphan.png"]));
    expect(mock.remove).toHaveBeenCalledWith([
      "automation/one.webp",
      "automation/nested/two.mp4",
    ]);
    expect(mock.deleteRunRows).toHaveBeenCalledTimes(1);
  });

  it("paginates storage listings and respects the 1,000-file deletion batch limit", async () => {
    const paths = Array.from({ length: 1_005 }, (_, index) => `automation/${String(index).padStart(4, "0")}.webp`);
    const mock = makeSupabaseMock(paths);

    const result = await cleanupAllAutomationRunData(mock.client as unknown as ReturnType<typeof createSupabaseAdminClient>);

    expect(result.removedMedia).toBe(1_005);
    expect(mock.remove).toHaveBeenCalledTimes(2);
    expect(mock.remove.mock.calls.map(([batch]) => batch.length)).toEqual([1_000, 5]);
    expect(mock.files.size).toBe(0);
  });

  it("does not delete run rows if the bucket inventory cannot be read", async () => {
    const mock = makeSupabaseMock(["automation/one.webp"]);
    mock.setListFailure(true);

    await expect(cleanupAllAutomationRunData(mock.client as unknown as ReturnType<typeof createSupabaseAdminClient>))
      .rejects.toThrow("automation_media_cleanup_list_failed");
    expect(mock.deleteRunRows).not.toHaveBeenCalled();
  });

  it("defers destructive cleanup while an Upload-Post schedule request is unresolved", async () => {
    const mock = makeSupabaseMock(["automation/pending-video.mp4"]);
    mock.setActiveSchedules([{
      id: "output-1",
      schedule_status: "processing",
      schedule_error_code: "upload_post_request_unconfirmed",
      schedule_attempted_at: "2026-10-17T10:00:00.000Z",
    }]);

    const result = await cleanupAllAutomationRunData(mock.client as unknown as ReturnType<typeof createSupabaseAdminClient>);

    expect(result).toEqual({ deletedRuns: 0, deletedOutputs: 0, removedMedia: 0, deferred: true, preservedSchedules: 1 });
    expect(mock.files.has("automation/pending-video.mp4")).toBe(true);
    expect(mock.deleteRunRows).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
  });
});
