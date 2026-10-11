import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCurrentAuthUser = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/auth-session", () => ({
  getCurrentAuthUser: mockGetCurrentAuthUser,
}));

import { POST } from "@/app/api/cards/normalize-image/route";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function makeRequest(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return { formData: async () => formData } as unknown as Request;
}

describe("POST /api/cards/normalize-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentAuthUser.mockResolvedValue({ id: "user-1" });
  });

  it("normalizes a valid image to an orientation-corrected JPEG data URL", async () => {
    const response = await POST(makeRequest(new File([ONE_PIXEL_PNG], "camera-photo.png", { type: "image/png" })));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      dataUrl: expect.stringMatching(/^data:image\/jpeg;base64,/),
      mimeType: "image/jpeg",
      name: "camera-photo.png",
    });
  });

  it("rejects a payload that is not an image", async () => {
    const response = await POST(makeRequest(new File(["not an image"], "notes.txt", { type: "text/plain" })));

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ errorCode: "invalid_image" });
  });

  it("requires an authenticated user before processing the file", async () => {
    mockGetCurrentAuthUser.mockResolvedValueOnce(null);

    const response = await POST(makeRequest(new File([ONE_PIXEL_PNG], "camera-photo.png", { type: "image/png" })));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ errorCode: "auth_required" });
  });
});
