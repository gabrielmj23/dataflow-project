import { useCallback, useEffect, useRef, useState } from "react";

import type { EngineLogLevel, EngineNodeStatus } from "@/engine/engine";
import type { RemoteConfig } from "@/ws/remote-config";

type ControllerState = {
  connected: boolean;
  runnerConnected: boolean;
  isEngineRunning: boolean;
  consoleText: string;
  nodeStatuses: Record<string, EngineNodeStatus>;
};

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function useWsControllerClient(config: RemoteConfig): {
  enabled: boolean;
  state: ControllerState;
  lastError?: string;
  run: () => void;
  stop: () => void;
  requestSnapshot: () => void;
} {
  const enabled = config.role === "controller";

  const [state, setState] = useState<ControllerState>({
    connected: false,
    runnerConnected: false,
    isEngineRunning: false,
    consoleText: "",
    nodeStatuses: {},
  });
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  const wsRef = useRef<WebSocket | null>(null);
  const requestIdRef = useRef(0);

  const nextRequestId = () => {
    requestIdRef.current += 1;
    return `c_${requestIdRef.current}`;
  };

  const send = useCallback((obj: unknown) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(obj));
  }, []);

  const run = useCallback(() => {
    const requestId = nextRequestId();
    send({ type: "control", requestId, action: "run" });
  }, [send]);

  const stop = useCallback(() => {
    const requestId = nextRequestId();
    send({ type: "control", requestId, action: "stop" });
  }, [send]);

  const requestSnapshot = useCallback(() => {
    const requestId = nextRequestId();
    send({ type: "get_snapshot", requestId });
  }, [send]);

  useEffect(() => {
    if (!enabled) {
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
      setLastError(undefined);
      setState((prev) => ({
        ...prev,
        connected: false,
        runnerConnected: false,
      }));
      return;
    }

    let stopped = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (stopped) return;

      try {
        const ws = new WebSocket(config.url);
        wsRef.current = ws;

        ws.onopen = () => {
          setLastError(undefined);
          setState((prev) => ({ ...prev, connected: true }));
          send({
            type: "hello",
            role: "controller",
            protocol: 1,
            sessionKey: config.sessionKey,
            clientName: "controller",
          });
          // Ask for current snapshot right away.
          requestSnapshot();
        };

        ws.onclose = () => {
          setState((prev) => ({ ...prev, connected: false }));
          if (stopped) return;
          reconnectTimer = window.setTimeout(connect, 1500);
        };

        ws.onerror = () => {
          // onclose will reconnect
        };

        ws.onmessage = (ev) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(String(ev.data));
          } catch {
            return;
          }

          if (typeof parsed !== "object" || parsed == null) return;
          const msg = parsed as Record<string, unknown>;
          const type = msg.type;
          if (typeof type !== "string") return;

          if (type === "runner_status") {
            setState((prev) => ({
              ...prev,
              runnerConnected: msg.connected === true,
            }));
            return;
          }

          if (type === "snapshot") {
            const nodeStatuses =
              typeof msg.nodeStatuses === "object" && msg.nodeStatuses != null
                ? (msg.nodeStatuses as Record<string, EngineNodeStatus>)
                : {};
            const consoleText =
              typeof msg.consoleText === "string" ? msg.consoleText : "";
            const isEngineRunning = msg.isEngineRunning === true;
            setState((prev) => ({
              ...prev,
              nodeStatuses,
              consoleText,
              isEngineRunning,
            }));
            return;
          }

          if (type === "run_start") {
            setState((prev) => ({ ...prev, isEngineRunning: true }));
            return;
          }

          if (type === "run_end") {
            setState((prev) => ({ ...prev, isEngineRunning: false }));
            return;
          }

          if (type === "node_status") {
            const nodeId = typeof msg.nodeId === "string" ? msg.nodeId : "";
            const status = msg.status as EngineNodeStatus;
            if (!nodeId) return;
            setState((prev) => ({
              ...prev,
              nodeStatuses: { ...prev.nodeStatuses, [nodeId]: status },
            }));
            return;
          }

          if (type === "engine_log") {
            const level = (msg.level as EngineLogLevel) ?? "info";
            const text = typeof msg.text === "string" ? msg.text : "";
            if (!text) return;

            setState((prev) => {
              const line = level === "error" ? `Error: ${text}` : text;
              const next = prev.consoleText
                ? `${prev.consoleText}\n${line}`
                : line;
              // Keep it bounded.
              const lines = next.split("\n");
              const MAX = 200;
              const trimmed =
                lines.length > MAX
                  ? lines.slice(lines.length - MAX).join("\n")
                  : next;
              return { ...prev, consoleText: trimmed };
            });
          }

          if (type === "error") {
            const message =
              typeof msg.message === "string" ? msg.message : "unknown error";
            setLastError(message);
          }
        };
      } catch (err) {
        setLastError(stringifyError(err));
        reconnectTimer = window.setTimeout(connect, 2000);
      }
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer != null) window.clearTimeout(reconnectTimer);
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    };
  }, [enabled, config.url, config.sessionKey, send, requestSnapshot]);

  return { enabled, state, lastError, run, stop, requestSnapshot };
}
