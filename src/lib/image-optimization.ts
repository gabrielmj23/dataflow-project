type OptimizeImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  maxBytes?: number;
  initialQuality?: number;
  minQuality?: number;
};

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) {
    return dataUrl.length;
  }

  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function loadFileImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo cargar la imagen seleccionada."));
    };

    image.src = objectUrl;
  });
}

function chooseOutputMime(
  canvas: HTMLCanvasElement,
): "image/webp" | "image/jpeg" {
  const webpProbe = canvas.toDataURL("image/webp", 0.8);
  return webpProbe.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
}

function drawImageToCanvas(
  image: HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo procesar la imagen");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function optimizeImageFileToDataUrl(
  file: File,
  options: OptimizeImageOptions = {},
): Promise<string> {
  const {
    maxWidth = 1280,
    maxHeight = 720,
    maxBytes = 900 * 1024,
    initialQuality = 0.84,
    minQuality = 0.52,
  } = options;

  const image = await loadFileImage(file);
  const widthRatio = maxWidth / image.naturalWidth;
  const heightRatio = maxHeight / image.naturalHeight;
  const ratio = Math.min(1, widthRatio, heightRatio);

  let targetWidth = Math.max(1, Math.round(image.naturalWidth * ratio));
  let targetHeight = Math.max(1, Math.round(image.naturalHeight * ratio));
  let bestCandidate = "";

  for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
    const canvas = drawImageToCanvas(image, targetWidth, targetHeight);
    const outputMime = chooseOutputMime(canvas);

    let quality = initialQuality;
    for (let qualityAttempt = 0; qualityAttempt < 6; qualityAttempt += 1) {
      const candidate = canvas.toDataURL(outputMime, quality);
      bestCandidate = candidate;

      if (estimateDataUrlBytes(candidate) <= maxBytes) {
        return candidate;
      }

      if (quality <= minQuality) {
        break;
      }

      quality = Math.max(minQuality, quality - 0.07);
    }

    targetWidth = Math.max(320, Math.round(targetWidth * 0.85));
    targetHeight = Math.max(180, Math.round(targetHeight * 0.85));
  }

  return bestCandidate;
}
