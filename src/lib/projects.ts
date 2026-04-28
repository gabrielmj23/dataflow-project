import type { SerializedProgramV1 } from "@/flow/serialization";
import { fetchAuthApi } from "@/lib/auth";
import { toJpeg } from "html-to-image";

const GUEST_PROJECT_AUTHOR_NAME_KEY = "nodi-project-guest-author-name";

type ApiErrorResponse = {
  error?: string;
};

export type ProjectAuthorKind = "user" | "guest";

export type PublicProjectSummary = {
  id: string;
  name: string;
  description: string;
  authorId: string | null;
  authorKind: ProjectAuthorKind;
  authorName: string;
  isPublic: boolean;
  thumbnail: string | null;
  remixedFromId: string | null;
  remixedFromName: string | null;
  viewerCanEdit: boolean;
};

export type PublishedProject = PublicProjectSummary & {
  remixedFromId: string | null;
  remixedFromName: string | null;
  program: SerializedProgramV1;
  createdAt: string;
  updatedAt: string;
};

function getApiBaseUrl(): string {
  return import.meta.env.VITE_AUTH_API_URL?.trim() || "/api";
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("No se pudo procesar la imagen seleccionada.");
  }

  return response.blob();
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

  return `No se pudo completar la solicitud (${response.status}).`;
}

export async function publishProject(params: {
  name: string;
  description?: string;
  program: SerializedProgramV1;
  thumbnail: string;
  isPublic?: boolean;
  remixedFrom?: string;
  guestAuthorName?: string;
}) {
  const response = await fetchAuthApi(`${getApiBaseUrl()}/projects`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      description: params.description,
      thumbnail: params.thumbnail,
      isPublic: params.isPublic,
      remixedFrom: params.remixedFrom,
      program: params.program,
      guestAuthorName: params.guestAuthorName,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as { id: string; name?: string };
}

export async function captureProjectThumbnail(
  node: HTMLElement,
  options?: {
    filter?: (node: HTMLElement) => boolean;
  },
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
    filter: options?.filter,
  });
}

export async function uploadProjectThumbnail(
  thumbnail: string | Blob,
): Promise<string> {
  if (typeof thumbnail === "string") {
    const trimmedThumbnail = thumbnail.trim();
    if (!trimmedThumbnail) {
      throw new Error("Debes seleccionar una miniatura válida.");
    }

    if (isHttpUrl(trimmedThumbnail)) {
      return trimmedThumbnail;
    }

    thumbnail = await dataUrlToBlob(trimmedThumbnail);
  }

  const formData = new FormData();
  formData.append("thumbnail", thumbnail, "project-thumbnail.jpg");

  const response = await fetchAuthApi(
    `${getApiBaseUrl()}/projects/thumbnail-upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as { url?: unknown };
  if (typeof payload.url !== "string" || !payload.url.trim()) {
    throw new Error("El servidor no devolvió una URL de miniatura válida.");
  }

  return payload.url;
}

export async function fetchLatestPublishedProjects(limit: number = 12) {
  const response = await fetchAuthApi(
    `${getApiBaseUrl()}/projects?page=1&pageSize=${Math.max(1, limit)}`,
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const projects = (await response.json()) as PublicProjectSummary[];
  if (!Array.isArray(projects)) {
    return [];
  }

  return projects;
}

export async function fetchMyProjects(limit: number = 12) {
  const response = await fetchAuthApi(
    `${getApiBaseUrl()}/projects?mine=true&page=1&pageSize=${Math.max(1, limit)}`,
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const projects = (await response.json()) as PublicProjectSummary[];
  if (!Array.isArray(projects)) {
    return [];
  }

  return projects;
}

export async function fetchPublishedProjectById(projectId: string) {
  const response = await fetchAuthApi(
    `${getApiBaseUrl()}/projects/${projectId}`,
    {},
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as PublishedProject;
}

export async function updatePublishedProject(params: {
  id: string;
  name: string;
  description?: string;
  program: SerializedProgramV1;
  thumbnail?: string;
  isPublic?: boolean;
  guestAuthorName?: string;
}) {
  const response = await fetchAuthApi(
    `${getApiBaseUrl()}/projects/${params.id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: params.name,
        description: params.description,
        thumbnail: params.thumbnail,
        isPublic: params.isPublic,
        program: params.program,
        guestAuthorName: params.guestAuthorName,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as { id: string; name?: string };
}

export async function deletePublishedProject(projectId: string) {
  const response = await fetchAuthApi(
    `${getApiBaseUrl()}/projects/${projectId}`,
    {
      method: "DELETE",
    },
  );

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export function getStoredGuestProjectAuthorName(): string {
  const storedValue = localStorage.getItem(GUEST_PROJECT_AUTHOR_NAME_KEY);
  return storedValue?.trim() ?? "";
}

export function persistGuestProjectAuthorName(name: string) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    localStorage.removeItem(GUEST_PROJECT_AUTHOR_NAME_KEY);
    return;
  }

  localStorage.setItem(GUEST_PROJECT_AUTHOR_NAME_KEY, normalizedName);
}
