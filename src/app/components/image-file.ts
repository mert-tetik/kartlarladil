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
