import type { SerializedProgramV1 } from "@/flow/serialization";
import { getStoredAuthToken } from "@/lib/auth";
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

function buildProjectRequestHeaders(): Record<string, string> {
  const token = getStoredAuthToken();
  return token
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      }
    : {
        "Content-Type": "application/json",
      };
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
  const response = await fetch(`${getApiBaseUrl()}/projects`, {
    method: "POST",
    credentials: "include",
    headers: buildProjectRequestHeaders(),
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

export async function fetchLatestPublishedProjects(limit: number = 12) {
  const response = await fetch(
    `${getApiBaseUrl()}/projects?page=1&pageSize=${Math.max(1, limit)}`,
    {
      credentials: "include",
    },
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
  const response = await fetch(
    `${getApiBaseUrl()}/projects?mine=true&page=1&pageSize=${Math.max(1, limit)}`,
    {
      credentials: "include",
      headers: buildProjectRequestHeaders(),
    },
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
  const response = await fetch(`${getApiBaseUrl()}/projects/${projectId}`, {
    credentials: "include",
    headers: buildProjectRequestHeaders(),
  });

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
  const response = await fetch(`${getApiBaseUrl()}/projects/${params.id}`, {
    method: "PATCH",
    credentials: "include",
    headers: buildProjectRequestHeaders(),
    body: JSON.stringify({
      name: params.name,
      description: params.description,
      thumbnail: params.thumbnail,
      isPublic: params.isPublic,
      program: params.program,
      guestAuthorName: params.guestAuthorName,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as { id: string; name?: string };
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
