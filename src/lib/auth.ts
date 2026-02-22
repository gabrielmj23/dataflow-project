import type { AuthSessionUser } from "@/types";

type AuthResponse = {
  user: AuthSessionUser;
  token: string;
};

type ApiErrorResponse = {
  error?: string;
};

const AUTH_CURRENT_KEY = "nodi-auth-current-user";
const AUTH_TOKEN_KEY = "nodi-auth-token";

function getAuthApiBaseUrl(): string {
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

  return `Error de autenticación (${response.status}).`;
}

async function postAuth<TBody>(
  endpoint: "/auth/log-in" | "/auth/sign-up",
  body: TBody,
): Promise<AuthResponse> {
  const response = await fetch(`${getAuthApiBaseUrl()}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as AuthResponse;
}

export async function logIn(params: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return postAuth("/auth/log-in", params);
}

export async function signUp(params: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return postAuth("/auth/sign-up", params);
}

export function getStoredAuthUser(): AuthSessionUser | null {
  const raw = localStorage.getItem(AUTH_CURRENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthSessionUser;
    if (
      typeof parsed?.email === "string" &&
      typeof parsed?.name === "string" &&
      typeof parsed?.id === "string"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function clearStoredAuthSession() {
  localStorage.removeItem(AUTH_CURRENT_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function persistAuthSession(auth: AuthResponse) {
  localStorage.setItem(AUTH_CURRENT_KEY, JSON.stringify(auth.user));
  localStorage.setItem(AUTH_TOKEN_KEY, auth.token);
}
