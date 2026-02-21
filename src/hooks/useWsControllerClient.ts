import { useCallback, useEffect, useRef, useState } from "react";

import {
  DataflowEngine,
  type EngineNodeStatus,
} from "@/engine/engine";
import { Arc, DataToken, PortAddress } from "@/engine/program-elements";
import {
  buildEngineStoresFromFlowGraph,
  type RemoteSubflowPayload,
} from "@/engine/deserialize-program";
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

function coerceNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error("Número inválido.");
  return n;
}

function computeSequenceValues(args: unknown[]): number[] {
  const startArg = args[0];
  const endArg = args[1];
  const stepArg = args[2];

  const start = typeof startArg === "number" ? startArg : 1;
  const end = typeof endArg === "number" ? endArg : 10;
  const stepRaw = typeof stepArg === "number" ? stepArg : 1;
  const step = Number.isFinite(stepRaw) && stepRaw !== 0 ? stepRaw : 1;

  if (start > end && step > 0) {
    throw new Error(
      "El valor de inicio no puede ser mayor que el valor de fin cuando el paso es positivo.",
    );
  }
  if (start < end && step < 0) {
    throw new Error(
      "El valor de inicio no puede ser menor que el valor de fin cuando el paso es negativo.",
    );
  }

  const sequence: number[] = [];
  for (let i = start; i <= end; i += step) {
    sequence.push(i);
  }
  return sequence;
}

function computeOperation(op: string, args: unknown[]): unknown {
  switch (op) {
    case "sum": {
      const a = coerceNumber(args[0]);
      const b = coerceNumber(args[1]);
      return a + b;
    }
    case "subtract": {
      const a = coerceNumber(args[0]);
      const b = coerceNumber(args[1]);
      return a - b;
    }
    case "multiply": {
      const a = coerceNumber(args[0]);
      const b = coerceNumber(args[1]);
      return a * b;
    }
    case "divide": {
      const a = coerceNumber(args[0]);
      const b = coerceNumber(args[1]);
      const result = a / b;
      if (!Number.isFinite(result)) {
        throw new Error(
          "División no definida (dividir entre cero u otro caso inválido)",
        );
      }
      return result;
    }
    case "mod": {
      const a = coerceNumber(args[0]);
      const b = coerceNumber(args[1]);
      return a % b;
    }
    case "power": {
      const a = coerceNumber(args[0]);
      const b = coerceNumber(args[1]);
      if (a === 0 && b === 0) {
        throw new Error("Potencia no definida: 0^0 no está permitido");
      }
      const result = Math.pow(a, b);
      if (!Number.isFinite(result) || Number.isNaN(result)) {
        throw new Error("Potencia no definida para estos valores");
      }
      return result;
    }
    case "floor": {
      const a = coerceNumber(args[0]);
      return Math.floor(a);
    }
    case "ceiling": {
      const a = coerceNumber(args[0]);
      return Math.ceil(a);
    }
    case "round": {
      const a = coerceNumber(args[0]);
      return Math.round(a);
    }
    case "concat": {
      const a = args[0] ?? "";
      const b = args[1] ?? "";
      return String(a) + String(b);
    }
    case "replaceText": {
      const source = String(args[0] ?? "");
      const needle = String(args[1] ?? "");
      if (needle.length === 0) return source;
      const replacement = String(args[2] ?? "");
      return source.split(needle).join(replacement);
    }
    case "subtractText": {
      const source = String(args[0] ?? "");
      const needle = String(args[1] ?? "");
      if (needle.length === 0) return source;
      return source.split(needle).join("");
    }
    case "sliceText": {
      const source = String(args[0] ?? "");
      const len = source.length;
      const rawStart = Number(args[1]);
      const rawEnd = Number(args[2]);

      const start = Number.isFinite(rawStart) ? Math.max(0, Math.floor(rawStart)) : 0;
      const end = Number.isFinite(rawEnd)
        ? Math.min(len, Math.floor(rawEnd) + 1)
        : len;

      const from = Math.min(len, Math.max(0, start));
      const to = Math.min(len, Math.max(from, end));
      return source.slice(from, to);
    }
    case "generateSequence": {
      return computeSequenceValues(args);
    }
    case "pulseSequence": {
      return computeSequenceValues(args);
    }
    case "zip": {
      const listA = Array.isArray(args[0]) ? args[0] : [];
      const listB = Array.isArray(args[1]) ? args[1] : [];
      const length = Math.min(listA.length, listB.length);
      const zipped: unknown[] = [];
      for (let i = 0; i < length; i += 1) {
        zipped.push([listA[i], listB[i]]);
      }
      return zipped;
    }
    case "unzip": {
      const tuples = Array.isArray(args[0]) ? args[0] : [];
      const listA: unknown[] = [];
      const listB: unknown[] = [];
      for (const tuple of tuples) {
        if (Array.isArray(tuple) && tuple.length >= 2) {
          listA.push(tuple[0]);
          listB.push(tuple[1]);
        }
      }
      return { listA, listB };
    }
    case "filterTruthy": {
      const inputList = Array.isArray(args[0]) ? args[0] : [];
      return inputList.filter((item) => Boolean(item));
    }
    case "mapIdentity": {
      const inputList = Array.isArray(args[0]) ? args[0] : [];
      return [...inputList];
    }
    case "reduceSum": {
      const inputList = Array.isArray(args[0]) ? args[0] : [];
      return inputList.reduce((acc, curr) => (acc as number) + (curr as number), 0);
    }
    case "count": {
      const inputList = Array.isArray(args[0]) ? args[0] : [];
      return inputList.length;
    }
    case "scatter": {
      const values = Array.isArray(args[0]) ? args[0] : [];
      const rawCount = typeof args[1] === "number" ? args[1] : Number(args[1]);
      const outputCount = Number.isFinite(rawCount)
        ? Math.max(0, Math.floor(rawCount))
        : 0;

      if (outputCount === 0) return [];

      const len = values.length;
      const buckets: unknown[][] = Array.from({ length: outputCount }, () => []);
      for (let i = 0; i < outputCount; i += 1) {
        const start = Math.floor((i * len) / outputCount);
        const end = Math.floor(((i + 1) * len) / outputCount);
        buckets[i] = values.slice(start, end);
      }
      return buckets;
    }
    case "gather": {
      const result: unknown[] = [];
      for (const value of args) {
        if (Array.isArray(value)) {
          result.push(...value);
        } else if (value !== undefined) {
          result.push(value);
        }
      }
      return result;
    }
    case "sortListAsc":
    case "sortListDesc": {
      const inputList = Array.isArray(args[0]) ? [...args[0]] : [];
      const order = op === "sortListDesc" ? "desc" : "asc";
      const isNumeric = inputList.every(
        (item) => typeof item === "number" && Number.isFinite(item),
      );

      if (isNumeric) {
        const numericList = inputList as number[];
        return [...numericList].sort((a, b) =>
          order === "asc" ? a - b : b - a,
        );
      }

      const decorated = inputList.map((value) => ({
        value,
        key: value == null ? "" : String(value),
      }));

      decorated.sort((a, b) =>
        order === "asc"
          ? a.key.localeCompare(b.key)
          : b.key.localeCompare(a.key),
      );

      return decorated.map((item) => item.value);
    }
    default:
      throw new Error(`Operación no soportada: ${op}`);
  }
}

/**
 * Executes a remote subflow payload
 * @param payload
 * @param args
 */
async function executeSubflowPayload(
  payload: RemoteSubflowPayload,
  args: unknown[],
): Promise<unknown> {
  const stores = buildEngineStoresFromFlowGraph({
    nodes: payload.nodes,
    edges: payload.edges,
  });

  const engine = new DataflowEngine();
  const engineNodes = stores.nodeStore.getNodes();
  const engineArcs = stores.arcStore.getArcs();

  const augmentedArcs = [...engineArcs];
  if (payload.hasAnyOutput) {
    for (const out of payload.outputSources) {
      augmentedArcs.push(
        new Arc(
          new PortAddress(out.nodeId, out.portId),
          new PortAddress("", "out-1"),
          `${out.nodeId}:${out.portId}->out-1`,
        ),
      );
    }
  }

  engine.loadProgram({ nodes: engineNodes, arcs: augmentedArcs });

  const initialTokens = payload.selectedInputs.map(
    (addr, idx) =>
      new DataToken(args[idx], new PortAddress(addr.nodeId, addr.portId)),
  );

  const emitted = await engine.run({ initialTokens });

  if (!payload.hasAnyOutput) return [];

  const token = emitted.find(
    (t) => t.location.nodeId === "" && t.location.portId === "out-1",
  );

  return token?.value;
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
  const controllerIdRef = useRef<string>("");
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
      Promise.resolve().then(() => {
        setLastError(undefined);
        setState((prev) => ({
          ...prev,
          connected: false,
          runnerConnected: false,
        }));
      });
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
          controllerIdRef.current = "";
          setState((prev) => ({ ...prev, connected: true }));
          send({
            type: "hello",
            role: "controller",
            protocol: 1,
            sessionKey: config.sessionKey,
            clientName: config.clientName?.trim() || "controller",
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

        ws.onmessage = async (ev) => {
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

          if (type === "welcome") {
            const clientId =
              typeof msg.clientId === "string" ? msg.clientId.trim() : "";
            controllerIdRef.current = clientId;
            return;
          }

          if (type === "runner_status") {
            setState((prev) => ({
              ...prev,
              runnerConnected: msg.connected === true,
            }));
            return;
          }

          if (type === "snapshot") {
            const targetControllerId =
              typeof msg.controllerId === "string"
                ? msg.controllerId.trim()
                : "";
            const ownControllerId = controllerIdRef.current;
            if (targetControllerId && ownControllerId && targetControllerId !== ownControllerId) {
              return;
            }

            const nodeStatuses =
              typeof msg.nodeStatuses === "object" && msg.nodeStatuses != null
                ? (msg.nodeStatuses as Record<string, EngineNodeStatus>)
                : {};
            const incomingConsoleText =
              typeof msg.consoleText === "string" ? msg.consoleText : "";
            const isEngineRunning = msg.isEngineRunning === true;
            setState((prev) => ({
              ...prev,
              nodeStatuses,
              consoleText:
                incomingConsoleText.trim().length > 0
                  ? incomingConsoleText
                  : prev.consoleText,
              isEngineRunning,
            }));
            return;
          }

          if (type === "run_start") {
            setState((prev) => ({
              ...prev,
              isEngineRunning: true,
              consoleText: "",
            }));
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

          if (type === "node_execution") {
            const targetControllerId =
              typeof msg.controllerId === "string"
                ? msg.controllerId.trim()
                : "";
            const ownControllerId = controllerIdRef.current;
            if (targetControllerId && ownControllerId && targetControllerId !== ownControllerId) {
              return;
            }

            const line = typeof msg.line === "string" ? msg.line : "";
            if (!line) return;

            setState((prev) => {
              const next = prev.consoleText ? `${prev.consoleText}\n${line}` : line;
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
            return;
          }

          if (type === "exec_request") {
            const requestId =
              typeof msg.requestId === "string" ? msg.requestId : "";
            const op = typeof msg.op === "string" ? msg.op : "";
            const args = Array.isArray(msg.args) ? msg.args : [];
            if (!requestId || !op) return;

            try {
              const result =
                op === "subflow" && msg.subflow
                  ? await executeSubflowPayload(
                      msg.subflow as RemoteSubflowPayload,
                      args,
                    )
                  : computeOperation(op, args);
              send({ type: "exec_result", requestId, ok: true, result });
            } catch (err) {
              send({
                type: "exec_result",
                requestId,
                ok: false,
                error: stringifyError(err),
              });
            }
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
  }, [
    enabled,
    config.url,
    config.sessionKey,
    send,
    requestSnapshot,
    config.clientName,
  ]);

  return { enabled, state, lastError, run, stop, requestSnapshot };
}
