import { describe, expect, it } from "vitest";
import {
  createOfflineNotesVisualTestNotes,
  OFFLINE_NOTES_VISUAL_TEST_PROFILE_ID,
} from "@/features/inventory/offline-notes-visual-test-fixtures";

describe("offline notes visual test fixtures", () => {
  it("injects ten saved-note entries using the selected native locale", () => {
    const notes = createOfflineNotesVisualTestNotes("es");

    expect(notes).toHaveLength(10);
    expect(notes.map(({ note }) => note.text)).toEqual([
      "serendipity",
      "sobremesa",
      "Wanderlust",
      "dépaysement",
      "magari",
      "saudade",
      "gezellig",
      "tęsknota",
      "тоска",
      "木漏れ日",
    ]);
    expect(notes.every(({ profileId, note }) =>
      profileId === OFFLINE_NOTES_VISUAL_TEST_PROFILE_ID && note.nativeLocale === "es",
    )).toBe(true);
    expect(new Set(notes.map(({ note }) => note.id)).size).toBe(10);
  });
});
