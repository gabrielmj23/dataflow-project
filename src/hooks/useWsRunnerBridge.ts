import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { EngineNodeStatus } from "@/engine/engine";
import { DataToken, PortAddress } from "@/engine/program-elements";
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

const OP_LABEL_BY_KEY: Record<string, string> = {
  sum: "Sumar",
  subtract: "Restar",
  multiply: "Multiplicar",
  divide: "Dividir",
  mod: "Módulo",
  power: "Potencia",
  floor: "Piso",
  ceiling: "Techo",
  round: "Redondear",
  concat: "Concatenar",
  replacetext: "Reemplazar texto",
  subtracttext: "Sustraer texto",
  slicetext: "Recortar texto",
  generatesequence: "Generar secuencia",
  pulsesequence: "Pulso de secuencia",
  zip: "Unir en pares",
  unzip: "Separar pares",
  filtertruthy: "Filtrar",
  mapidentity: "Mapear",
  reducesum: "Acumular",
  count: "Contar",
  scatter: "Distribuir",
  gather: "Reunir",
  sortlistasc: "Ordenar lista asc",
  sortlistdesc: "Ordenar lista desc",
  subflow: "Subflujo",
};

type UseWsRunnerBridgeParams = {
  remoteConfig: RemoteConfig;
  nodes: FlowNode[];
  programName: string;
  isEngineRunning: boolean;
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

function formatVerboseValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (value instanceof Error) return value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function trimTrailingUndefined(values: unknown[]): unknown[] {
  const next = [...values];
  while (next.length > 0 && next[next.length - 1] === undefined) {
    next.pop();
  }
  return next;
}

function opToLabel(op: string): string {
  const key = op.trim().toLowerCase();
  const mapped = OP_LABEL_BY_KEY[key];
  if (mapped) return mapped;
  if (!key) return "Operación";
  return `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

function isTransientWsError(error: unknown): boolean {
  const text = stringifyError(error).toLowerCase();
  return (
    text.includes("conexión ws cerrada") ||
    text.includes("ws no conectado") ||
    text.includes("ws no inicializado") ||
    text.includes("timeout esperando respuesta del controller")
  );
}

async function delayMs(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function decodeRemoteResultForEngine(req: RemoteExecutionRequest, raw: unknown): unknown {
  const op = req.op.trim().toLowerCase();

  if (op === "pulsesequence") {
    const values = Array.isArray(raw) ? raw : [];
    return values.map(
      (value) => new DataToken(value, new PortAddress("", "output")),
    );
  }

  if (op === "unzip") {
    let listA: unknown[] = [];
    let listB: unknown[] = [];

    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      listA = Array.isArray(obj.listA) ? obj.listA : [];
      listB = Array.isArray(obj.listB) ? obj.listB : [];
    }

    return [
      new DataToken(listA, new PortAddress("", "listA")),
      new DataToken(listB, new PortAddress("", "listB")),
    ];
  }

  if (op === "scatter") {
    const buckets = Array.isArray(raw) ? raw : [];
    return buckets.map((bucket, index) =>
      new DataToken(
        Array.isArray(bucket) ? bucket : [],
        new PortAddress("", `output${index + 1}`),
      ),
    );
  }

  return raw;
}

type RemoteConsoleState = {
  counter: number;
  lines: string[];
};

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
  const nodesRef = useRef(params.nodes);
  const programNameRef = useRef(params.programName);
  const isEngineRunningRef = useRef(params.isEngineRunning);
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
    nodesRef.current = params.nodes;
  }, [params.nodes]);

  useEffect(() => {
    programNameRef.current = params.programName;
  }, [params.programName]);

  useEffect(() => {
    isEngineRunningRef.current = params.isEngineRunning;
  }, [params.isEngineRunning]);

  useEffect(() => {
    activePromptRef.current = params.activeRuntimePrompt;
  }, [params.activeRuntimePrompt]);

  const [wsState, setWsState] = useState<RunnerWsState>({
    connected: false,
  });
  const [controllers, setControllers] = useState<RemoteControllerInfo[]>([]);
  const remoteConsoleByControllerRef = useRef<Map<string, RemoteConsoleState>>(
    new Map(),
  );

  const nodeLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of params.nodes) {
      const data =
        node.data && typeof node.data === "object"
          ? (node.data as Record<string, unknown>)
          : null;
      const label = typeof data?.label === "string" ? data.label.trim() : "";
      if (label) {
        map.set(String(node.id), label);
      }
    }
    return map;
  }, [params.nodes]);

  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);
  const execPendingRef = useRef(
    new Map<
      string,
      {
        request: RemoteExecutionRequest;
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
    async (req: RemoteExecutionRequest) => {
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

      const executeRemoteOnce = () => {
        const requestId = `exec_${nextSeq()}`;

        return new Promise<unknown>((resolve, reject) => {
          waitForOpen()
            .then(() => {
              const timeoutId = window.setTimeout(() => {
                execPendingRef.current.delete(requestId);
                reject(new Error("Timeout esperando respuesta del controller."));
              }, 15_000);

              execPendingRef.current.set(requestId, {
                request: req,
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
      };

      const MAX_RETRIES = 1;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        try {
          return await executeRemoteOnce();
        } catch (error) {
          const hasRetry = attempt < MAX_RETRIES;
          if (!hasRetry || !isTransientWsError(error)) {
            throw error;
          }
          await delayMs(400);
        }
      }

      throw new Error("Ejecución remota falló tras reintento.");
    },
    [enabled, send],
  );

  const sendSnapshot = useCallback(
    (requestId?: unknown, controllerId?: unknown) => {
      const nodeStatuses: Record<string, EngineNodeStatus> = {};
      for (const n of nodesRef.current) {
        const s = statusFromClassName(n.className);
        if (s) nodeStatuses[String(n.id)] = s;
      }

      const controllerKey =
        typeof controllerId === "string" ? controllerId.trim() : "";
      const consoleState = controllerKey
        ? remoteConsoleByControllerRef.current.get(controllerKey)
        : undefined;

      send({
        type: "snapshot",
        requestId,
        seq: nextSeq(),
        ts: Date.now(),
        programName: programNameRef.current,
        isEngineRunning: isEngineRunningRef.current,
        nodeStatuses,
        ...(controllerKey ? { controllerId: controllerKey } : null),
        consoleText: consoleState?.lines.join("\n") ?? "",
        activePrompt:
          activePromptRef.current != null
            ? {
                nodeId: activePromptRef.current.nodeId,
                prompt: activePromptRef.current.prompt,
                inputType: activePromptRef.current.type,
                defaultValue: activePromptRef.current.defaultValue,
              }
            : null,
      });
    },
    [send, remoteConsoleByControllerRef],
  );

  const emitEngineEvent = useCallback(
    (e: EngineEvent) => {
      if (!enabled) return;

      const base = { seq: nextSeq(), ts: Date.now() };

      if (e.type === "run_start") {
        remoteConsoleByControllerRef.current = new Map();
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
        return;
      }
      if (e.type === "node_execution") {
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
    [enabled, nodeLabelById, send],
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
            sendSnapshot(msg.requestId, msg.controllerId);
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
              const req = pending.request;
              const controllerId =
                typeof msg.controllerId === "string" && msg.controllerId.trim()
                  ? msg.controllerId.trim()
                  : req.controllerId;
              const existing =
                remoteConsoleByControllerRef.current.get(controllerId) ?? {
                  counter: 0,
                  lines: [],
                };
              const nodeNumber = existing.counter + 1;
              const nodeLabel =
                nodeLabelById.get(req.nodeId) || opToLabel(req.op) || `Nodo ${nodeNumber}`;
              const argsText = trimTrailingUndefined(req.args)
                .map((value) => formatVerboseValue(value))
                .join(", ");
              const decodedResult = decodeRemoteResultForEngine(req, msg.result);
              const resultText = formatVerboseValue(msg.result);
              const line = `Nodo${nodeNumber}: ${nodeLabel}(${argsText}) -> ${resultText}`;
              const MAX = 200;
              const nextState: RemoteConsoleState = {
                counter: nodeNumber,
                lines: [...existing.lines, line].slice(-MAX),
              };
              remoteConsoleByControllerRef.current.set(controllerId, nextState);

              send({
                type: "node_execution",
                seq: nextSeq(),
                ts: Date.now(),
                nodeId: req.nodeId,
                index: nodeNumber,
                controllerId,
                line,
              });

              pending.resolve(decodedResult);
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
