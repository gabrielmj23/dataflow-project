import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { EngineNodeStatus } from "@/engine/engine";
import type { FlowNode } from "@/utils/flow";
import type { RuntimePrompt } from "@/hooks/useRuntimeConsole";
import type { EngineRunnerEvent } from "@/hooks/useEngineRunner";
import { getRemoteConfig } from "@/ws/remote-config";

type RunnerWsState = {
  connected: boolean;
  lastError?: string;
};

type EngineEvent = EngineRunnerEvent;

type UseWsRunnerBridgeParams = {
  nodes: FlowNode[];
  programName: string;
  isEngineRunning: boolean;
  consoleOutputText: string;
  activeRuntimePrompt: RuntimePrompt | null;
  onRunClick: () => void;
  onStopClick: () => void;
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
} {
  const config = useMemo(() => getRemoteConfig(), []);
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

  const wsRef = useRef<WebSocket | null>(null);
  const seqRef = useRef(0);

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
    if (!enabled) return;

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
        };

        ws.onclose = () => {
          setWsState((prev) => ({ ...prev, connected: false }));
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
    };
  }, [enabled, config.url, config.sessionKey, send, sendSnapshot]);

  return { wsState, emitEngineEvent };
}
