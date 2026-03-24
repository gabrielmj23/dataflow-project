import * as nsfwjs from "nsfwjs";
import "@tensorflow/tfjs";

type NsfwScoreMap = {
  drawing: number;
  hentai: number;
  neutral: number;
  porn: number;
  sexy: number;
};

type NsfwResult = {
  isAllowed: boolean;
  scores: NsfwScoreMap;
  reason?: string;
};

let modelPromise: Promise<nsfwjs.NSFWJS> | null = null;

function getModel() {
  if (!modelPromise) {
    modelPromise = nsfwjs.load();
  }

  return modelPromise;
}

function emptyScores(): NsfwScoreMap {
  return {
    drawing: 0,
    hentai: 0,
    neutral: 0,
    porn: 0,
    sexy: 0,
  };
}

function toScoreMap(
  predictions: Array<{ className: string; probability: number }>,
): NsfwScoreMap {
  const scores = emptyScores();

  for (const prediction of predictions) {
    const key = prediction.className.toLowerCase();
    if (key === "drawing") {
      scores.drawing = prediction.probability;
      continue;
    }
    if (key === "hentai") {
      scores.hentai = prediction.probability;
      continue;
    }
    if (key === "neutral") {
      scores.neutral = prediction.probability;
      continue;
    }
    if (key === "porn") {
      scores.porn = prediction.probability;
      continue;
    }
    if (key === "sexy") {
      scores.sexy = prediction.probability;
    }
  }

  return scores;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo abrir la imagen."));
    image.src = dataUrl;
  });
}

export async function moderateImageDataUrl(dataUrl: string): Promise<NsfwResult> {
  const [model, image] = await Promise.all([getModel(), loadImage(dataUrl)]);
  const predictions = await model.classify(image);
  const scores = toScoreMap(predictions);

  const hardUnsafe = scores.porn >= 0.4 || scores.hentai >= 0.4;
  const weightedUnsafeScore = scores.porn + scores.hentai + scores.sexy * 0.6;
  const softUnsafe = weightedUnsafeScore >= 0.6;

  if (hardUnsafe || softUnsafe) {
    return {
      isAllowed: false,
      scores,
      reason: "La imagen no es apta como portada de proyecto.",
    };
  }

  return {
    isAllowed: true,
    scores,
  };
}
