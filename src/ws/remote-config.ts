export type RemoteRole = "runner" | "controller" | "disabled";

export type RemoteConfig = {
  role: RemoteRole;
  /** WebSocket endpoint, e.g. ws://localhost:8787 */
  url: string;
  /** Shared session key used to group runner/controllers */
  sessionKey: string;
};

function trimOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function defaultWsUrl(): string {
  const scheme = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.hostname || "localhost";
  return `${scheme}://${host}:8787`;
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
 *
 * Supported env vars:
 * - `VITE_WS_ROLE=runner|controller`
 * - `VITE_WS_SESSION_KEY=...`
 * - `VITE_WS_URL=...`
 */
export function getRemoteConfig(): RemoteConfig {
  const params = new URLSearchParams(window.location.search);

  const roleRaw =
    trimOrEmpty(params.get("role")) ||
    trimOrEmpty(import.meta.env.VITE_WS_ROLE);

  const role: RemoteRole =
    roleRaw === "runner" || roleRaw === "controller" ? roleRaw : "disabled";

  const sessionKey =
    trimOrEmpty(params.get("key")) ||
    trimOrEmpty(import.meta.env.VITE_WS_SESSION_KEY) ||
    "";

  const url =
    trimOrEmpty(params.get("ws")) ||
    trimOrEmpty(import.meta.env.VITE_WS_URL) ||
    defaultWsUrl();

  if (role === "disabled") {
    return { role, url, sessionKey };
  }

  return {
    role,
    url,
    sessionKey: sessionKey || "DEV",
  };
}
