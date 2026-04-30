import { fetchAuthApi, getStoredAuthToken } from "@/lib/auth";

type ApiErrorResponse = {
  error?: string;
};

export type CustomNodeSummary = {
  id: string;
  name: string;
  description: string;
  code: string;
  authorId: string;
  authorName: string;
  createdAt: string;
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

  return `No se pudieron cargar los nodos personalizados (${response.status}).`;
}

export async function fetchCustomNodes(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const query = new URLSearchParams();

  if (params?.search?.trim()) {
    query.set("search", params.search.trim());
  }

  if (params?.page) {
    query.set("page", String(params.page));
  }

  if (params?.pageSize) {
    query.set("pageSize", String(params.pageSize));
  }

  const querySuffix = query.toString();
  const url = `${getApiBaseUrl()}/nodes${querySuffix ? `?${querySuffix}` : ""}`;

  const response = await fetchAuthApi(url);

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as CustomNodeSummary[];
  return Array.isArray(payload) ? payload : [];
}

export async function createCustomNode(params: {
  name: string;
  description: string;
  code: string;
}) {
  if (!getStoredAuthToken()) {
    throw new Error("Debes iniciar sesión para compartir nodos.");
  }

  const response = await fetchAuthApi(`${getApiBaseUrl()}/nodes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      description: params.description,
      code: params.code,
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as {
    id: string;
    name: string;
    description: string;
    code: string;
  };
}
