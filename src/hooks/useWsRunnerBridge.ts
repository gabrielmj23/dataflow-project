import { useCallback, useEffect, useRef, useState } from "react";

import type { EngineNodeStatus } from "@/engine/engine";
import type { FlowNode } from "@/utils/flow";
import type { RuntimePrompt } from "@/hooks/useRuntimeConsole";
import type { EngineRunnerEvent } from "@/hooks/useEngineRunner";
import type { RemoteConfig } from "@/ws/remote-config";
import type { RemoteControllerInfo } from "@/ws/remote-controllers-context";
import type { RemoteSubflowPayload } from "@/engine/deserialize-program";

type RunnerWsState = {
  connected: boolean;
  lastError?: string;
};

type EngineEvent = EngineRunnerEvent;

type UseWsRunnerBridgeParams = {
  remoteConfig: RemoteConfig;
  nodes: FlowNode[];
  programName: string;
  isEngineRunning: boolean;
  consoleOutputText: string;
  activeRuntimePrompt: RuntimePrompt | null;
  onRunClick: () => void;
  onStopClick: () => void;
};

export type RemoteExecutionRequest = {
  nodeId: string;
  controllerId: string;
  op: string;
  args: unknown[];
  subflow?: RemoteSubflowPayload;
};

function statusFromClassName(className?: string): EngineNodeStatus | undefined {
  if (!className) return undefined;
  if (className.includes("rf-node-running")) return "running";
  if (className.includes("rf-node-error")) return "error";
  if (className.includes("rf-node-done")) return "done";
  if (className.includes("rf-node-waiting")) return "waiting";
  return undefined;
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Runner-side WS bridge.
 *
 * - Connects as `role=runner`
 * - Streams engine events to controllers
 * - Accepts `control` + `get_snapshot` (+ optional `prompt_reply`)
 *
 * Usage
 * - Call this hook in `App`.
 * - Pass `emitEngineEvent` into `useEngineRunner({ onEngineEvent: ... })`.
 */
export function useWsRunnerBridge(params: UseWsRunnerBridgeParams): {
  wsState: RunnerWsState;
  emitEngineEvent: (e: EngineEvent) => void;
  controllers: RemoteControllerInfo[];
  executeRemote: (req: RemoteExecutionRequest) => Promise<unknown>;
} {
  const config = params.remoteConfig;
  const enabled = config.role === "runner";

  const onRunClickRef = useRef(params.onRunClick);
  const onStopClickRef = useRef(params.onStopClick);
  const activePromptRef = useRef<RuntimePrompt | null>(
    params.activeRuntimePrompt,
  );

  useEffect(() => {
    onRunClickRef.current = params.onRunClick;
  }, [params.onRunClick]);

  useEffect(() => {
    onStopClickRef.current = params.onStopClick;
  }, [params.onStopClick]);

  useEffect(() => {
    activePromptRef.current = params.activeRuntimePrompt;
  }, [params.activeRuntimePrompt]);

  const [wsState, setWsState] = useState<RunnerWsState>({
    connected: false,
  });
  const [controllers, setControllers] = useState<RemoteControllerInfo[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);
  const execPendingRef = useRef(
    new Map<
      string,
      {
        resolve: (value: unknown) => void;
        reject: (reason?: unknown) => void;
        timeoutId: number;
      }
    >(),
  );

  const send = useCallback(
    (obj: unknown) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(obj));
    },
    [wsRef],
  );

  const nextSeq = () => {
    seqRef.current += 1;
    return seqRef.current;
  };

  const executeRemote = useCallback(
    (req: RemoteExecutionRequest) => {
      if (!enabled) {
        return Promise.reject(new Error("Remote runner no está habilitado."));
      }

      if (!req.controllerId) {
        return Promise.reject(new Error("No hay controller seleccionado."));
      }

      const waitForOpen = () =>
        new Promise<WebSocket>((resolve, reject) => {
          const wsNow = wsRef.current;
          if (!wsNow) {
            reject(
              new Error(
                "WS no inicializado. Revisa ajustes remotos y reintenta.",
              ),
            );
            return;
          }

          if (wsNow.readyState === WebSocket.OPEN) {
            resolve(wsNow);
            return;
          }

          const timeoutId = window.setTimeout(() => {
            window.clearInterval(intervalId);
            reject(
              new Error(
                "WS no conectado. Verifica el servidor y la URL en ajustes remotos.",
              ),
            );
          }, 2500);

          const intervalId = window.setInterval(() => {
            const wsCheck = wsRef.current;
            if (!wsCheck) return;
            if (wsCheck.readyState === WebSocket.OPEN) {
              window.clearTimeout(timeoutId);
              window.clearInterval(intervalId);
              resolve(wsCheck);
            }
            if (wsCheck.readyState === WebSocket.CLOSED) {
              window.clearTimeout(timeoutId);
              window.clearInterval(intervalId);
              reject(
                new Error(
                  "WS no conectado. Verifica el servidor y la URL en ajustes remotos.",
                ),
              );
            }
          }, 120);
        });

      const requestId = `exec_${nextSeq()}`;

      return new Promise<unknown>((resolve, reject) => {
        waitForOpen()
          .then(() => {
            const timeoutId = window.setTimeout(() => {
              execPendingRef.current.delete(requestId);
              reject(new Error("Timeout esperando respuesta del controller."));
            }, 15_000);

            execPendingRef.current.set(requestId, {
              resolve,
              reject,
              timeoutId,
            });

            send({
              type: "exec_request",
              requestId,
              controllerId: req.controllerId,
              nodeId: req.nodeId,
              op: req.op,
              args: req.args,
              ...(req.subflow ? { subflow: req.subflow } : {}),
            });
          })
          .catch(reject);
      });
    },
    [enabled, send],
  );

  const sendSnapshot = useCallback(
    (requestId?: unknown) => {
      const nodeStatuses: Record<string, EngineNodeStatus> = {};
      for (const n of params.nodes) {
        const s = statusFromClassName(n.className);
        if (s) nodeStatuses[String(n.id)] = s;
      }

      send({
        type: "snapshot",
        requestId,
        seq: nextSeq(),
        ts: Date.now(),
        programName: params.programName,
        isEngineRunning: params.isEngineRunning,
        nodeStatuses,
        consoleText: params.consoleOutputText,
        activePrompt:
          params.activeRuntimePrompt != null
            ? {
                nodeId: params.activeRuntimePrompt.nodeId,
                prompt: params.activeRuntimePrompt.prompt,
                inputType: params.activeRuntimePrompt.type,
                defaultValue: params.activeRuntimePrompt.defaultValue,
              }
            : null,
      });
    },
    [
      params.nodes,
      params.programName,
      params.isEngineRunning,
      params.consoleOutputText,
      params.activeRuntimePrompt,
      send,
    ],
  );

  const emitEngineEvent = useCallback(
    (e: EngineEvent) => {
      if (!enabled) return;

      const base = { seq: nextSeq(), ts: Date.now() };

      if (e.type === "run_start") {
        send({ type: "run_start", ...base });
        return;
      }
      if (e.type === "run_end") {
        send({
          type: "run_end",
          ...base,
          ok: e.ok,
          error: e.error,
        });
        return;
      }
      if (e.type === "node_status") {
        send({
          type: "node_status",
          ...base,
          nodeId: e.nodeId,
          status: e.status,
          errorText: e.errorText,
        });
        return;
      }
      if (e.type === "log") {
        send({
          type: "engine_log",
          ...base,
          level: e.level,
          nodeId: e.nodeId,
          text: e.text,
        });
        return;
      }
      if (e.type === "prompt") {
        send({
          type: "prompt",
          ...base,
          nodeId: e.nodeId,
          prompt: e.prompt,
          inputType: e.inputType,
          defaultValue: e.defaultValue,
        });
      }
    },
    [enabled, send],
  );

  useEffect(() => {
    if (!enabled) {
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
      setWsState({ connected: false, lastError: undefined });
      setControllers([]);
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
          setWsState({ connected: true, lastError: undefined });
          send({
            type: "hello",
            role: "runner",
            protocol: 1,
            sessionKey: config.sessionKey,
            hubName: "hub",
          });
          // Push an initial snapshot to help controllers that connect later.
          sendSnapshot();
          send({ type: "get_controllers" });
        };

        ws.onclose = () => {
          setWsState((prev) => ({ ...prev, connected: false }));
          setControllers([]);
          if (stopped) return;
          reconnectTimer = window.setTimeout(connect, 1500);
        };

        ws.onerror = () => {
          // onclose will schedule reconnect
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

          if (type === "get_snapshot") {
            sendSnapshot(msg.requestId);
            return;
          }

          if (type === "controllers_list") {
            const listRaw = Array.isArray(msg.controllers)
              ? msg.controllers
              : [];
            const list = listRaw
              .map((entry): RemoteControllerInfo | null => {
                if (!entry || typeof entry !== "object") return null;
                const item = entry as Record<string, unknown>;
                const id = typeof item.id === "string" ? item.id : "";
                if (!id) return null;
                const name =
                  typeof item.name === "string" ? item.name : undefined;
                return name ? { id, name } : { id };
              })
              .filter((value): value is RemoteControllerInfo => value !== null);
            setControllers(list);
            return;
          }

          if (type === "control") {
            const action = msg.action;
            const requestId = msg.requestId;
            try {
              if (action === "run") {
                onRunClickRef.current();
                send({ type: "control_ack", requestId, accepted: true });
                return;
              }
              if (action === "stop") {
                onStopClickRef.current();
                send({ type: "control_ack", requestId, accepted: true });
                return;
              }

              send({
                type: "control_ack",
                requestId,
                accepted: false,
                error: `unknown action: ${String(action)}`,
              });
            } catch (err) {
              send({
                type: "control_ack",
                requestId,
                accepted: false,
                error: stringifyError(err),
              });
            }
            return;
          }

          if (type === "prompt_reply") {
            const requestId = msg.requestId;
            const nodeId = String(msg.nodeId ?? "");
            const value = msg.value;

            const p = activePromptRef.current;
            if (!p || String(p.nodeId) !== nodeId) {
              send({
                type: "control_ack",
                requestId,
                accepted: false,
                error: "no active prompt for that nodeId",
              });
              return;
            }

            try {
              p.submit(value);
              send({ type: "control_ack", requestId, accepted: true });
            } catch (err) {
              send({
                type: "control_ack",
                requestId,
                accepted: false,
                error: stringifyError(err),
              });
            }
            return;
          }

          if (type === "exec_result") {
            const requestId =
              typeof msg.requestId === "string" ? msg.requestId : "";
            if (!requestId) return;
            const pending = execPendingRef.current.get(requestId);
            if (!pending) return;
            execPendingRef.current.delete(requestId);
            window.clearTimeout(pending.timeoutId);

            const ok = msg.ok === true;
            if (ok) {
              pending.resolve(msg.result);
            } else {
              const errorText =
                typeof msg.error === "string"
                  ? msg.error
                  : "Ejecución remota falló.";
              pending.reject(new Error(errorText));
            }
            return;
          }
        };
      } catch (err) {
        setWsState({ connected: false, lastError: stringifyError(err) });
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
      for (const pending of execPendingRef.current.values()) {
        window.clearTimeout(pending.timeoutId);
        pending.reject(new Error("Conexión WS cerrada."));
      }
      execPendingRef.current.clear();
    };
  }, [enabled, config.url, config.sessionKey, send, sendSnapshot]);

  return { wsState, emitEngineEvent, controllers, executeRemote };
}
