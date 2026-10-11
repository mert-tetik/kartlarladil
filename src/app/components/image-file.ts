export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("invalid_image"));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("invalid_image"));
        return;
      }

      if (reader.result.startsWith("data:image/")) {
        resolve(reader.result);
        return;
      }

      // Some Android camera providers return an image File with an empty or
      // generic MIME type. Re-label the data URL from the filename so the
      // browser can still decode the selected photo.
      const mimeType = getImageMimeType(file);
      if (!mimeType || !reader.result.startsWith("data:")) {
        reject(new Error("invalid_image"));
        return;
      }

      resolve(reader.result.replace(/^data:[^;,]+/, `data:${mimeType}`));
    };
    reader.readAsDataURL(file);
  });
}

export async function normalizeImageFile(file: File): Promise<{ dataUrl: string; name: string }> {
  const formData = new FormData();
  formData.append("file", file, file.name || "image");

  let response: Response;
  try {
    response = await fetch("/api/cards/normalize-image", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error("image_normalization_failed");
  }

  const payload = await response.json().catch(() => null) as {
    dataUrl?: unknown;
    name?: unknown;
    errorCode?: unknown;
  } | null;

  if (!response.ok) {
    const errorCode = typeof payload?.errorCode === "string" ? payload.errorCode : "image_normalization_failed";
    throw new Error(errorCode);
  }

  if (typeof payload?.dataUrl !== "string" || !payload.dataUrl.startsWith("data:image/jpeg;base64,")) {
    throw new Error("image_normalization_failed");
  }

  return {
    dataUrl: payload.dataUrl,
    name: typeof payload.name === "string" && payload.name.trim() ? payload.name : file.name || "image.jpg",
  };
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/") || Boolean(getImageMimeType(file));
}

function getImageMimeType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    case "avif":
      return "image/avif";
    default:
      return file.type.startsWith("image/") ? file.type : null;
  }
}
