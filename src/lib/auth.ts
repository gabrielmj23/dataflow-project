import type { AuthSessionUser } from "@/types";

export type AuthResponse = {
  user: AuthSessionUser;
  token: string;
};

type ApiErrorResponse = {
  error?: string;
};

const AUTH_CURRENT_KEY = "nodi-auth-current-user";
const AUTH_TOKEN_KEY = "nodi-auth-token";
const AUTH_SESSION_EVENT = "nodi-auth-session-changed";

let refreshInFlight: Promise<AuthResponse | null> | null = null;

function getAuthApiBaseUrl(): string {
  return import.meta.env.VITE_AUTH_API_URL?.trim() || "/api";
}

function emitAuthSessionChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
}

function mergeAuthHeader(
  headers: HeadersInit | undefined,
  token: string | null,
): Headers {
  const resolvedHeaders = new Headers(headers);

  if (token) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  } else {
    resolvedHeaders.delete("Authorization");
  }

  return resolvedHeaders;
}

function isAuthEndpoint(url: string): boolean {
  return url.includes("/auth/");
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
    credentials: "include",
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

async function refreshAuthTokenSilently(): Promise<AuthResponse | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const response = await fetch(`${getAuthApiBaseUrl()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      clearStoredAuthSession();
      return null;
    }

    const auth = (await response.json()) as AuthResponse;
    persistAuthSession(auth);
    return auth;
  })()
    .catch(() => {
      clearStoredAuthSession();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

export async function fetchAuthApi(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const currentToken = getStoredAuthToken();
  const requestInit: RequestInit = {
    ...init,
    credentials: "include",
    headers: mergeAuthHeader(init?.headers, currentToken),
  };

  const response = await fetch(input, requestInit);
  if (response.status !== 401 || isAuthEndpoint(input)) {
    return response;
  }

  if (!currentToken) {
    return response;
  }

  const refreshedAuth = await refreshAuthTokenSilently();
  if (!refreshedAuth) {
    return response;
  }

  const retryInit: RequestInit = {
    ...init,
    credentials: "include",
    headers: mergeAuthHeader(init?.headers, refreshedAuth.token),
  };

  return fetch(input, retryInit);
}

export async function logOut(): Promise<void> {
  try {
    await fetch(`${getAuthApiBaseUrl()}/auth/log-out`, {
      method: "POST",
      credentials: "include",
    });
  } finally {
    clearStoredAuthSession();
  }
}

export function subscribeAuthSessionChange(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {
      // no-op outside browser environments.
    };
  }

  window.addEventListener(AUTH_SESSION_EVENT, listener);
  return () => {
    window.removeEventListener(AUTH_SESSION_EVENT, listener);
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
  emitAuthSessionChanged();
}

export function getStoredAuthToken(): string | null {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token && token.trim() ? token : null;
}

export function persistAuthSession(auth: AuthResponse) {
  localStorage.setItem(AUTH_CURRENT_KEY, JSON.stringify(auth.user));
  localStorage.setItem(AUTH_TOKEN_KEY, auth.token);
  emitAuthSessionChanged();
}
