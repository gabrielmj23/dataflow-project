import type { SerializedProgramV1 } from "@/flow/serialization";
import { getStoredAuthToken } from "@/lib/auth";
import { toJpeg } from "html-to-image";

type ApiErrorResponse = {
  error?: string;
};

function getApiBaseUrl(): string {
  return import.meta.env.VITE_AUTH_API_URL?.trim() || "/api";
}

async function readApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ApiErrorResponse;
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // no-op
  }

  return `No se pudo publicar el proyecto (${response.status}).`;
}

export async function publishProject(params: {
  name: string;
  program: SerializedProgramV1;
  thumbnail: string;
}) {
  const token = getStoredAuthToken();
  if (!token) {
    throw new Error("Debes iniciar sesión para publicar proyectos.");
  }

  const response = await fetch(`${getApiBaseUrl()}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: params.name,
      thumbnail: params.thumbnail,
      program: params.program,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json();
}

export async function captureProjectThumbnail(
  node: HTMLElement,
): Promise<string> {
  const width = Math.max(320, Math.floor(node.clientWidth));
  const height = Math.max(180, Math.floor(node.clientHeight));

  return toJpeg(node, {
    quality: 0.72,
    cacheBust: true,
    pixelRatio: 1,
    canvasWidth: Math.min(width, 1280),
    canvasHeight: Math.min(height, 720),
    backgroundColor: "#f8fafc",
  });
}
