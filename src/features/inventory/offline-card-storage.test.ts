import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listOfflineGeneratedDrafts,
  listOfflineSavedNotes,
  removeOfflineGeneratedDraft,
  removeOfflineSavedNote,
  saveOfflineGeneratedDraft,
} from "@/features/inventory/offline-card-storage";

describe("offline note and generated-card removal", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("indexedDB", { open: vi.fn(() => { throw new Error("indexeddb_unavailable"); }) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps dismissed records hidden when IndexedDB cannot open", async () => {
    await Promise.all([
      removeOfflineSavedNote("guest", "saved-note-123"),
      removeOfflineGeneratedDraft("guest", "generated-draft-123"),
    ]);

    await expect(listOfflineSavedNotes("guest")).resolves.toEqual([]);
    await expect(listOfflineGeneratedDrafts("guest")).resolves.toEqual([]);
    expect(localStorage.getItem("foxiesdeck-offline-v1:dismissed:notes:guest")).toContain("saved-note-123");
    expect(localStorage.getItem("foxiesdeck-offline-v1:dismissed:drafts:guest")).toContain("generated-draft-123");
  });

  it("removes localStorage fallback copies immediately without waiting for IndexedDB", async () => {
    localStorage.setItem("foxiesdeck-offline-v1:fallback:notes:guest", JSON.stringify([{
      key: "guest:saved-note-456",
      profileId: "guest",
      note: { id: "saved-note-456", text: "offline word", targetLanguage: "en", nativeLocale: "tr" },
    }]));

    await removeOfflineSavedNote("guest", "saved-note-456");

    await expect(listOfflineSavedNotes("guest")).resolves.toEqual([]);
    expect(JSON.parse(localStorage.getItem("foxiesdeck-offline-v1:fallback:notes:guest") ?? "[]")).toEqual([]);
  });

  it("ignores a malformed stored draft without deleting the user's offline record", async () => {
    const key = "foxiesdeck-offline-v1:fallback:drafts:guest";
    const storedRecord = JSON.stringify([{
      key: "guest:draft-12345678",
      profileId: "guest",
      draft: {
        id: "draft-12345678",
        noteId: "note-12345678",
        sourceProfileId: "guest",
        storageProfileId: "guest",
        targetLanguage: "en",
        generated: { term: "malformed offline card" },
        createdAt: "2026-10-20T00:00:00.000Z",
        pendingAdd: true,
      },
    }]);
    localStorage.setItem(key, storedRecord);

    await expect(listOfflineGeneratedDrafts("guest")).resolves.toEqual([]);
    expect(localStorage.getItem(key)).toBe(storedRecord);
  });

  it("refuses to persist a draft that fails the generated-card schema", async () => {
    await expect(saveOfflineGeneratedDraft("guest", {
      id: "draft-12345678",
      noteId: "note-12345678",
      sourceProfileId: "guest",
      storageProfileId: "guest",
      targetLanguage: "en",
      generated: { term: "malformed offline card" } as never,
      createdAt: "2026-10-20T00:00:00.000Z",
    })).rejects.toThrow("offline_generated_card_draft_invalid");
  });
});
