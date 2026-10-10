import { describe, expect, it } from "vitest";
import { isImageFile, readImageFileAsDataUrl } from "@/app/components/image-file";

describe("image file preparation", () => {
  it("accepts camera files whose MIME type is empty when the filename is an image", async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "camera-photo.jpg", { type: "" });

    expect(isImageFile(file)).toBe(true);
    await expect(readImageFileAsDataUrl(file)).resolves.toMatch(/^data:image\/jpeg;base64,/);
  });

  it("keeps the browser-provided image MIME type for normal uploads", async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], "photo.png", { type: "image/png" });

    await expect(readImageFileAsDataUrl(file)).resolves.toMatch(/^data:image\/png;base64,/);
  });

  it("rejects files that are neither image files nor known image extensions", async () => {
    const file = new File(["not an image"], "notes.txt", { type: "text/plain" });

    expect(isImageFile(file)).toBe(false);
    await expect(readImageFileAsDataUrl(file)).rejects.toThrow("invalid_image");
  });
});
