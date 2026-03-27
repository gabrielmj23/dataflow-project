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
  endpoint:
    | "/auth/log-in"
    | "/auth/sign-up"
    | "/auth/request-password-reset"
    | "/auth/reset-password",
  body: TBody,
): Promise<AuthResponse | { message: string }> {
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

  return (await response.json()) as AuthResponse | { message: string };
}

export async function logIn(params: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return (await postAuth("/auth/log-in", params)) as AuthResponse;
}

export async function signUp(params: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return (await postAuth("/auth/sign-up", params)) as AuthResponse;
}

export async function requestPasswordReset(params: {
  email: string;
}): Promise<{ message: string }> {
  return (await postAuth("/auth/request-password-reset", params)) as {
    message: string;
  };
}

export async function resetPasswordWithCode(params: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return (await postAuth("/auth/reset-password", params)) as {
    message: string;
  };
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

export function getStoredAuthToken(): string | null {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token && token.trim() ? token : null;
}

export function persistAuthSession(auth: AuthResponse) {
  localStorage.setItem(AUTH_CURRENT_KEY, JSON.stringify(auth.user));
  localStorage.setItem(AUTH_TOKEN_KEY, auth.token);
}
