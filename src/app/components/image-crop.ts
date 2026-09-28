import type { Area } from "react-easy-crop";

export const MAX_CROPPED_IMAGE_DATA_URL_LENGTH = 600_000;

const MAX_CROPPED_IMAGE_DIMENSION = 1600;

export function cropImageToDataUrl(imageUrl: string, cropArea: Area): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.decoding = "async";
    image.onerror = () => reject(new Error("invalid_image"));
    image.onload = () => {
      const sourceWidth = image.naturalWidth;
      const sourceHeight = image.naturalHeight;

      if (!sourceWidth || !sourceHeight) {
        reject(new Error("invalid_image"));
        return;
      }

      const sourceX = Math.max(0, Math.min(sourceWidth - 1, Math.floor(cropArea.x)));
      const sourceY = Math.max(0, Math.min(sourceHeight - 1, Math.floor(cropArea.y)));
      const cropWidth = Math.max(1, Math.min(sourceWidth - sourceX, Math.ceil(cropArea.width)));
      const cropHeight = Math.max(1, Math.min(sourceHeight - sourceY, Math.ceil(cropArea.height)));
      const scale = Math.min(1, MAX_CROPPED_IMAGE_DIMENSION / Math.max(cropWidth, cropHeight));
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(cropWidth * scale));
      canvas.height = Math.max(1, Math.round(cropHeight * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("invalid_image"));
        return;
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(
        image,
        sourceX,
        sourceY,
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      let quality = 0.86;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);

      while (dataUrl.length > MAX_CROPPED_IMAGE_DATA_URL_LENGTH && quality > 0.58) {
        quality = Math.max(0.58, quality - 0.06);
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }

      if (dataUrl.length > MAX_CROPPED_IMAGE_DATA_URL_LENGTH) {
        const fallbackScale = Math.sqrt(MAX_CROPPED_IMAGE_DATA_URL_LENGTH / dataUrl.length);
        const fallbackWidth = Math.max(1, Math.floor(canvas.width * fallbackScale));
        const fallbackHeight = Math.max(1, Math.floor(canvas.height * fallbackScale));

        canvas.width = fallbackWidth;
        canvas.height = fallbackHeight;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, fallbackWidth, fallbackHeight);
        context.drawImage(
          image,
          sourceX,
          sourceY,
          cropWidth,
          cropHeight,
          0,
          0,
          fallbackWidth,
          fallbackHeight,
        );
        dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      }

      if (dataUrl.length > MAX_CROPPED_IMAGE_DATA_URL_LENGTH) {
        reject(new Error("invalid_image"));
        return;
      }

      resolve(dataUrl);
    };
    image.src = imageUrl;
  });
}
