import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  listOfflineGeneratedDrafts,
  listOfflineSavedNotes,
  removeOfflineGeneratedDraft,
  removeOfflineSavedNote,
} from "@/features/inventory/offline-card-storage";

describe("offline note and generated-card removal", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("indexedDB", { open: vi.fn(() => ({})) });
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
});
