import { fetchAuthApi, getStoredAuthToken } from "@/lib/auth";

type ApiErrorResponse = {
  error?: string;
};

export type ExtensionNodeSummary = {
  id: string;
  name: string;
  description: string;
  code: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type ExtensionListItem = {
  id: string;
  name: string;
  description: string;
  color: string;
  authorId: string;
  authorName: string;
  createdAt: string;
};

export type ExtensionDetails = ExtensionListItem & {
  nodes: ExtensionNodeSummary[];
};

function getApiBaseUrl(): string {
  return import.meta.env.VITE_AUTH_API_URL?.trim() || "/api";
}

async function readApiError(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const data = (await response.json()) as ApiErrorResponse;
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    // no-op
  }

  return `${fallbackMessage} (${response.status}).`;
}

function getRequiredAuthToken(errorMessage: string): string {
  const token = getStoredAuthToken();
  if (!token) {
    throw new Error(errorMessage);
  }

  return token;
}

export async function fetchExtensions(params?: {
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
  const url = `${getApiBaseUrl()}/extensions${querySuffix ? `?${querySuffix}` : ""}`;

  const response = await fetchAuthApi(url);

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "No se pudieron cargar las extensiones"),
    );
  }

  const payload = (await response.json()) as ExtensionListItem[];
  return Array.isArray(payload) ? payload : [];
}

export async function fetchExtensionById(extensionId: string) {
  const response = await fetchAuthApi(
    `${getApiBaseUrl()}/extensions/${extensionId}`,
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "No se pudo cargar la extension seleccionada",
      ),
    );
  }

  return (await response.json()) as ExtensionDetails;
}

export async function createExtension(params: {
  name: string;
  description: string;
  color: string;
}) {
  getRequiredAuthToken("Debes iniciar sesion para crear una extension.");

  const response = await fetchAuthApi(`${getApiBaseUrl()}/extensions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      description: params.description,
      color: params.color,
    }),
  });

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "No se pudo crear la extension"),
    );
  }

  return (await response.json()) as ExtensionListItem;
}

export async function fetchMyExtensions() {
  getRequiredAuthToken("Debes iniciar sesion para ver tus extensiones.");

  const response = await fetchAuthApi(`${getApiBaseUrl()}/users/me/extensions`);

  if (!response.ok) {
    throw new Error(
      await readApiError(response, "No se pudieron cargar tus extensiones"),
    );
  }

  const payload = (await response.json()) as ExtensionListItem[];
  return Array.isArray(payload) ? payload : [];
}

export async function addNodesToExtension(params: {
  extensionId: string;
  nodeIds: string[];
}) {
  getRequiredAuthToken(
    "Debes iniciar sesion para agregar nodos a una extension.",
  );

  const response = await fetchAuthApi(
    `${getApiBaseUrl()}/extensions/${params.extensionId}/nodes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        nodeIds: params.nodeIds,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      await readApiError(
        response,
        "No se pudieron asociar nodos a la extension",
      ),
    );
  }

  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? payload : [];
}
