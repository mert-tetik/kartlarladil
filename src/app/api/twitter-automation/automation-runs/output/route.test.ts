import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const { fromMock, removeMock, refreshRunMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  removeMock: vi.fn(),
  refreshRunMock: vi.fn(),
}));

vi.mock("@/features/twitter-automation/social-studio-auth", () => ({
  hasSocialStudioSession: () => true,
}));

vi.mock("@/features/twitter-automation/automation-run-service", () => ({
  refreshAutomationRunStatus: refreshRunMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: fromMock,
    storage: { from: () => ({ remove: removeMock }) },
  }),
}));

describe("automation output deletion", () => {
  it("removes the generated output and every referenced Storage object", async () => {
    const outputId = "5d13ccca-d537-4a5a-9a08-20df9c391007";
    const outputQuery = {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: outputId,
                run_id: "c77a7440-df76-4050-94c4-282118936152",
                status: "failed",
                media_path: "automation/output.png",
                media_paths: ["automation/output.png", "automation/output-2.png"],
              },
              error: null,
            }),
          }),
        }),
      }),
    };
    const deleteQuery = {
      eq: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: async () => ({ data: { id: outputId }, error: null }),
          }),
        }),
      }),
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "social_content_automation_outputs") return {
        ...outputQuery,
        delete: () => deleteQuery,
      };
      throw new Error(`Unexpected table: ${table}`);
    });
    removeMock.mockResolvedValue({ error: null });
    refreshRunMock.mockResolvedValue(undefined);

    const response = await DELETE(new NextRequest("http://localhost/api/twitter-automation/automation-runs/output", {
      method: "DELETE",
      body: JSON.stringify({ outputId, scope: "production" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ deleted: true, removedMediaCount: 2 });
    expect(removeMock).toHaveBeenCalledWith(["automation/output.png", "automation/output-2.png"]);
    expect(refreshRunMock).toHaveBeenCalledWith("c77a7440-df76-4050-94c4-282118936152", { autoSchedule: false });
  });
});
