import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCurrentAuthUser = vi.hoisted(() => vi.fn());
const mockCreateSupabaseServerClient = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mockGetCurrentAuthUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mockCreateSupabaseServerClient,
}));

import {
  deleteImageTextTranslationAction,
  getImageTextTranslationCountAction,
  listImageTextTranslationsAction,
  saveImageTextTranslationAction,
} from "@/features/cards/image-text-translate-actions";
import { getTranslationPreview } from "@/features/cards/image-text-translate-utils";

const sentence = {
  source: "This is a saved sentence.",
  translation: "Bu kayitli bir cumledir.",
  separators: [],
};

describe("image text translation persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentAuthUser.mockResolvedValue({ id: "user-1" });
  });

  it("truncates previews after the requested length", () => {
    expect(getTranslationPreview("  One   two   three  ", 11)).toBe("One two... ".trimEnd());
    expect(getTranslationPreview("Short", 20)).toBe("Short");
  });

  it("lists only mapped records returned in newest-first order", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: "newer", source_language: "en", native_locale: "tr", sentences: [sentence], created_at: "2026-09-19T12:00:00.000Z" },
        { id: "older", source_language: "de", native_locale: "en", sentences: [sentence], created_at: "2026-09-18T12:00:00.000Z" },
      ],
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order,
    };
    mockCreateSupabaseServerClient.mockResolvedValue({ from: vi.fn().mockReturnValue(query) });

    await expect(listImageTextTranslationsAction()).resolves.toEqual({
      success: true,
      data: {
        translations: [
          expect.objectContaining({ id: "newer", sourceLanguage: "en", nativeLocale: "tr" }),
          expect.objectContaining({ id: "older", sourceLanguage: "de", nativeLocale: "en" }),
        ],
        totalCount: 2,
      },
    });
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("gets the owner's translation count without loading translation rows", async () => {
    const eq = vi.fn().mockResolvedValue({ count: 3, error: null });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    mockCreateSupabaseServerClient.mockResolvedValue({ from });

    await expect(getImageTextTranslationCountAction()).resolves.toEqual({
      success: true,
      data: { totalCount: 3 },
    });
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("takes the owner id from the authenticated session when saving", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "saved-id", source_language: "en", native_locale: "tr", sentences: [sentence], created_at: "2026-09-19T12:00:00.000Z" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    mockCreateSupabaseServerClient.mockResolvedValue({ from });

    await expect(saveImageTextTranslationAction({ sourceLanguage: "en", nativeLocale: "tr", sentences: [sentence] })).resolves.toMatchObject({
      success: true,
      data: { id: "saved-id" },
    });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1", source_language: "en", native_locale: "tr" }));
  });

  it("does not contact Supabase for an unauthenticated request", async () => {
    mockGetCurrentAuthUser.mockResolvedValue(null);

    await expect(listImageTextTranslationsAction()).resolves.toEqual({ success: false, error: "unauthorized" });
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("deletes only the requested owner row", async () => {
    const finalEq = vi.fn().mockResolvedValue({ error: null });
    const firstEq = vi.fn().mockReturnValue({ eq: finalEq });
    const remove = vi.fn().mockReturnValue({ eq: firstEq });
    const from = vi.fn().mockReturnValue({ delete: remove });
    mockCreateSupabaseServerClient.mockResolvedValue({ from });

    await expect(deleteImageTextTranslationAction("00000000-0000-4000-8000-000000000001")).resolves.toEqual({
      success: true,
      data: { id: "00000000-0000-4000-8000-000000000001" },
    });
    expect(firstEq).toHaveBeenCalledWith("id", "00000000-0000-4000-8000-000000000001");
    expect(finalEq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
