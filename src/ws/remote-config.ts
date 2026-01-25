export type RemoteRole = "runner" | "controller" | "disabled";

export type RemoteConfig = {
  role: RemoteRole;
  /** WebSocket endpoint, e.g. ws://localhost:8787 */
  url: string;
  /** Shared session key used to group runner/controllers */
  sessionKey: string;
  /** Optional client name for controllers */
  clientName?: string;
};

const STORAGE_PREFIX = "dataflow.remote.";
const STORAGE_ROLE = `${STORAGE_PREFIX}role`;
const STORAGE_URL = `${STORAGE_PREFIX}url`;
const STORAGE_SESSION_KEY = `${STORAGE_PREFIX}sessionKey`;
const STORAGE_CLIENT_NAME = `${STORAGE_PREFIX}clientName`;

export function getRemoteConfigStorageKeys(): string[] {
  return [STORAGE_ROLE, STORAGE_URL, STORAGE_SESSION_KEY, STORAGE_CLIENT_NAME];
}

function trimOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function defaultWsUrl(): string {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "localhost";
  return `${scheme}://${host}:8787`;
}

function normalizeRole(value: string): RemoteRole {
  return value === "runner" || value === "controller" ? value : "disabled";
}

function withDefaults(partial: Partial<RemoteConfig>): RemoteConfig {
  const url = trimOrEmpty(partial.url) || defaultWsUrl();
  const sessionKey = trimOrEmpty(partial.sessionKey) || "DEV";
  const role = partial.role ?? "disabled";
  const clientName = trimOrEmpty(partial.clientName) || undefined;
  return {
    role,
    url,
    sessionKey: role === "disabled" ? sessionKey : sessionKey,
    clientName,
  };
}

function readFromStorage(): Partial<RemoteConfig> {
  try {
    const roleRaw = trimOrEmpty(window.localStorage.getItem(STORAGE_ROLE));
    const url = trimOrEmpty(window.localStorage.getItem(STORAGE_URL));
    const sessionKey = trimOrEmpty(
      window.localStorage.getItem(STORAGE_SESSION_KEY),
    );
    const clientName = trimOrEmpty(
      window.localStorage.getItem(STORAGE_CLIENT_NAME),
    );

    const role = roleRaw ? normalizeRole(roleRaw) : undefined;
    return {
      role,
      url: url || undefined,
      sessionKey: sessionKey || undefined,
      clientName: clientName || undefined,
    };
  } catch {
    return {};
  }
}

function readFromEnv(): Partial<RemoteConfig> {
  const roleRaw = trimOrEmpty(import.meta.env.VITE_WS_ROLE);
  const url = trimOrEmpty(import.meta.env.VITE_WS_URL);
  const sessionKey = trimOrEmpty(import.meta.env.VITE_WS_SESSION_KEY);
  const clientName = trimOrEmpty(import.meta.env.VITE_WS_CLIENT_NAME);

  return {
    role: roleRaw ? normalizeRole(roleRaw) : undefined,
    url: url || undefined,
    sessionKey: sessionKey || undefined,
    clientName: clientName || undefined,
  };
}

function readFromQuery(): Partial<RemoteConfig> {
  const params = new URLSearchParams(window.location.search);

  const roleRaw = trimOrEmpty(params.get("role"));
  const url = trimOrEmpty(params.get("ws"));
  const sessionKey = trimOrEmpty(params.get("key"));
  const clientName = trimOrEmpty(params.get("name"));

  return {
    role: roleRaw ? normalizeRole(roleRaw) : undefined,
    url: url || undefined,
    sessionKey: sessionKey || undefined,
    clientName: clientName || undefined,
  };
}

export function setStoredRemoteConfig(next: RemoteConfig): void {
  try {
    window.localStorage.setItem(STORAGE_ROLE, next.role);
    window.localStorage.setItem(STORAGE_URL, next.url);
    window.localStorage.setItem(STORAGE_SESSION_KEY, next.sessionKey);
    if (next.clientName) {
      window.localStorage.setItem(STORAGE_CLIENT_NAME, next.clientName);
    } else {
      window.localStorage.removeItem(STORAGE_CLIENT_NAME);
    }
  } catch {
    // ignore
  }
}

export function clearStoredRemoteConfig(): void {
  try {
    window.localStorage.removeItem(STORAGE_ROLE);
    window.localStorage.removeItem(STORAGE_URL);
    window.localStorage.removeItem(STORAGE_SESSION_KEY);
    window.localStorage.removeItem(STORAGE_CLIENT_NAME);
  } catch {
    // ignore
  }
}

/**
 * Remote execution config.
 *
 * Priority (highest to lowest):
 * - URL query params
 * - Vite env vars
 * - Defaults
 *
 * Supported query params:
 * - `role=runner|controller`
 * - `key=...` (session key)
 * - `ws=ws://host:port`
 * - `name=...` (controller name)
 *
 * Supported env vars:
 * - `VITE_WS_ROLE=runner|controller`
 * - `VITE_WS_SESSION_KEY=...`
 * - `VITE_WS_URL=...`
 * - `VITE_WS_CLIENT_NAME=...`
 */
export function getRemoteConfig(): RemoteConfig {
  const base = withDefaults({});
  const env = readFromEnv();
  const storage = readFromStorage();
  const query = readFromQuery();

  const merged: RemoteConfig = withDefaults({
    ...base,
    ...env,
    ...storage,
    ...query,
  });

  if (merged.role !== "disabled") {
    return { ...merged, sessionKey: merged.sessionKey || "DEV" };
  }

  return merged;
}
