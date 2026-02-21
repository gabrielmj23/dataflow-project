import { useCallback, useRef, useState } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import {
  DataflowEngine,
  type EngineLogLevel,
  type EngineNodeStatus,
} from "@/engine/engine";
import {
  deserializeProgramToEngineStores,
  type RemoteExecutor,
} from "@/engine/deserialize-program";
import { serializeProgram } from "@/flow/serialization";
import { clearEdgeValues, publishEdgeValue } from "@/flow/edge-value-bus";
import type { FlowEdge, FlowNode } from "@/utils/flow";
import type { RuntimePrompt } from "@/hooks/useRuntimeConsole";

export type EngineRunnerEvent =
  | { type: "run_start" }
  | { type: "run_end"; ok: boolean; error?: unknown }
  | {
      type: "node_status";
      nodeId: string;
      status: EngineNodeStatus;
      errorText?: string;
    }
  | {
      type: "log";
      level: EngineLogLevel;
      nodeId?: string;
      text: string;
    }
  | {
      type: "prompt";
      nodeId: string;
      prompt: string;
      inputType: "number" | "text";
      defaultValue?: unknown;
    }
  | {
      type: "edge_value";
      edgeId: string;
      value: unknown;
    }
  | {
      type: "node_execution";
      nodeId: string;
      operation?: string;
      inputs: unknown[];
      result: unknown;
    };

type UseEngineRunnerParams = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  programName: string;
  reactFlowInstance: ReactFlowInstance | null;
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  isRuntimeUpdateRef: React.MutableRefObject<boolean>;
  stepDelayMs: number;
  appendConsoleLines: (
    lines: string[],
    opts?: { level?: EngineLogLevel; nodeId?: string },
  ) => void;
  enqueuePrompt: (prompt: RuntimePrompt) => void;
  clearPromptQueue: () => void;
  /** Optional tap to observe engine runtime events (e.g. for remote WS streaming). */
  onEngineEvent?: (event: EngineRunnerEvent) => void;
  /** Optional remote executor for controller-based node execution. */
  remoteExecutor?: RemoteExecutor;
  resolveSubflowTemplate?: (id: string) => {
    id: string;
    name: string;
    inCount: number;
    outCount: number;
    nodes: FlowNode[];
    edges: FlowEdge[];
  } | null;
  maxSubflowDepth?: number;
};

export function useEngineRunner({
  nodes,
  edges,
  programName,
  reactFlowInstance,
  setNodes,
  isRuntimeUpdateRef,
  stepDelayMs,
  appendConsoleLines,
  enqueuePrompt,
  clearPromptQueue,
  onEngineEvent,
  remoteExecutor,
  resolveSubflowTemplate,
  maxSubflowDepth = 1000,
}: UseEngineRunnerParams) {
  const [isEngineRunning, setIsEngineRunning] = useState(false);
  const runAbortControllerRef = useRef<AbortController | null>(null);

  const stripRuntimeClasses = useCallback((className?: string) => {
    if (!className) return "";
    return className
      .split(/\s+/g)
      .filter(
        (c) =>
          c &&
          c !== "rf-node-waiting" &&
          c !== "rf-node-running" &&
          c !== "rf-node-error" &&
          c !== "rf-node-done",
      )
      .join(" ");
  }, []);

  const runtimeClassForStatus = useCallback((status: EngineNodeStatus) => {
    switch (status) {
      case "running":
        return "rf-node-running";
      case "error":
        return "rf-node-error";
      case "done":
        return "rf-node-done";
      case "waiting":
      default:
        return "rf-node-waiting";
    }
  }, []);

  const formatLogText = useCallback((data: unknown) => {
    const toEsBoolean = (v: boolean) => (v ? "Verdadero" : "Falso");
    const normalizeNumber = (n: number) => {
      const roundedInt = Math.round(n);
      if (Math.abs(n - roundedInt) < 1e-9) return roundedInt;
      return Math.round((n + Number.EPSILON) * 1000) / 1000; // keep up to 3 decimals
    };

    const normalizeValue = (value: unknown): unknown => {
      if (typeof value === "boolean") return toEsBoolean(value);
      if (typeof value === "number") return normalizeNumber(value);
      if (typeof value === "string") {
        const lower = value.trim().toLowerCase();
        if (lower === "true") return "Verdadero";
        if (lower === "false") return "Falso";
        try {
          const parsed = JSON.parse(value);
          const normalized = normalizeValue(parsed);
          return typeof normalized === "object"
            ? JSON.stringify(normalized)
            : String(normalized);
        } catch {
          return value;
        }
      }
      if (Array.isArray(value)) return value.map((v) => normalizeValue(v));
      if (value && typeof value === "object") {
        const entries = Object.entries(value).map(([k, v]) => [k, normalizeValue(v)]);
        return Object.fromEntries(entries);
      }
      return value;
    };

    if (typeof data === "string") {
      const normalized = normalizeValue(data);
      return typeof normalized === "string" ? normalized : String(normalized);
    }
    if (typeof data === "number") return String(normalizeNumber(data));
    if (typeof data === "boolean") return toEsBoolean(data);
    if (data instanceof Error) return data.message;
    try {
      return JSON.stringify(normalizeValue(data));
    } catch {
      return String(data);
    }
  }, []);

  const setAllNodesRuntimeState = useCallback(
    (status?: EngineNodeStatus) => {
      // Prevent history snapshots/reconciliation from treating these as edits.
      isRuntimeUpdateRef.current = true;

      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          className:
            status === undefined
              ? stripRuntimeClasses(n.className)
              : `${stripRuntimeClasses(n.className)} ${runtimeClassForStatus(
                  status,
                )}`.trim(),
          data:
            n.data && typeof n.data === "object"
              ? {
                  ...(n.data as Record<string, unknown>),
                  runtimeError: undefined,
                }
              : n.data,
        })),
      );
    },
    [isRuntimeUpdateRef, runtimeClassForStatus, setNodes, stripRuntimeClasses],
  );

  const onStopClick = useCallback(() => {
    // Cancel any pending prompts so the engine isn't left hanging.
    clearPromptQueue();
    runAbortControllerRef.current?.abort();
    runAbortControllerRef.current = null;
    setIsEngineRunning(false);
    setAllNodesRuntimeState(undefined);
  }, [clearPromptQueue, setAllNodesRuntimeState]);

  const onRunClick = useCallback(async () => {
    if (isEngineRunning) return;
    if (!reactFlowInstance) return;

    clearEdgeValues();

    // Reset visual runtime state for a new execution.
    setAllNodesRuntimeState("waiting");

    const abortController = new AbortController();
    runAbortControllerRef.current = abortController;
    setIsEngineRunning(true);

    const program = serializeProgram(
      {
        nodes,
        edges,
        programName,
      },
      false,
    );

    try {
      const onLogHandler = ({
        level,
        nodeId,
        message,
        data,
      }: {
        level: EngineLogLevel;
        nodeId?: string;
        message: string;
        data?: unknown;
      }) => {
        const payload = message === "write" ? data : (data ?? message);
        const baseText = formatLogText(payload);
        const text = level === "error" ? `Error: ${baseText}` : baseText;
        appendConsoleLines([text], { level, nodeId });
        onEngineEvent?.({ type: "log", level, nodeId, text });
      };

      const onPromptHandler = ({
        nodeId,
        prompt,
        type,
        defaultValue,
        submit,
        cancel,
      }: {
        nodeId: string;
        prompt: string;
        type: "number" | "text";
        defaultValue?: unknown;
        submit: (value: unknown) => void;
        cancel: () => void;
      }) => {
        enqueuePrompt({ nodeId, prompt, type, defaultValue, submit, cancel });
        onEngineEvent?.({
          type: "prompt",
          nodeId,
          prompt,
          inputType: type,
          defaultValue,
        });
      };

      const stores = deserializeProgramToEngineStores(program, {
        onLog: onLogHandler,
        onPrompt: onPromptHandler,
        signal: abortController.signal,
        remoteExecutor,
        resolveSubflowTemplate,
        maxSubflowDepth,
      });
      const engine = new DataflowEngine({ stepDelayMs });

      engine.setObserver({
        onRunStart: () => {
          onEngineEvent?.({ type: "run_start" });
        },
        onRunEnd: ({ ok, error }) => {
          onEngineEvent?.({ type: "run_end", ok, error });
        },
        onNodeStatus: ({ nodeId, status, error }) => {
          isRuntimeUpdateRef.current = true;
          const errorText =
            status === "error" && error !== undefined
              ? formatLogText(error)
              : undefined;

          onEngineEvent?.({ type: "node_status", nodeId, status, errorText });

          setNodes((prev) =>
            prev.map((n) => {
              if (String(n.id) !== String(nodeId)) return n;
              const base = stripRuntimeClasses(n.className);
              const next = `${base} ${runtimeClassForStatus(status)}`.trim();
              let data = n.data;
              if (data && typeof data === "object") {
                data = {
                  ...(data as Record<string, unknown>),
                  runtimeError: errorText,
                };
              }
              return { ...n, className: next, data };
            }),
          );
        },
        onLog: onLogHandler,
        onPrompt: onPromptHandler,
        onEdgeValue: ({ edgeId, value }) => {
          publishEdgeValue({ edgeId, value });
          onEngineEvent?.({ type: "edge_value", edgeId, value });
        },
        onNodeExecution: ({ nodeId, operation, inputs, result }) => {
          onEngineEvent?.({
            type: "node_execution",
            nodeId,
            operation,
            inputs,
            result,
          });
        },
      });

      engine.loadProgram({
        nodes: stores.nodeStore.getNodes(),
        arcs: stores.arcStore.getArcs(),
      });

      const trace = { executedNodeIds: [] as string[], batches: 0 };
      await engine.run({
        initialTokens: [],
        maxSteps: 10_000,
        signal: abortController.signal,
        trace,
      });
    } catch (err) {
      if ((err as { name?: unknown } | null)?.name === "AbortError") {
        // User-triggered stop/reset.
        return;
      }
      console.error("Failed to load program into engine:", err);
      appendConsoleLines([formatLogText(err)], { level: "error" });
    } finally {
      if (runAbortControllerRef.current === abortController) {
        runAbortControllerRef.current = null;
      }
      setIsEngineRunning(false);
    }
  }, [
    isEngineRunning,
    reactFlowInstance,
    setAllNodesRuntimeState,
    nodes,
    edges,
    programName,
    remoteExecutor,
    resolveSubflowTemplate,
    maxSubflowDepth,
    stepDelayMs,
    formatLogText,
    appendConsoleLines,
    onEngineEvent,
    enqueuePrompt,
    clearEdgeValues,
    publishEdgeValue,
    isRuntimeUpdateRef,
    setNodes,
    stripRuntimeClasses,
    runtimeClassForStatus,
  ]);

  return {
    isEngineRunning,
    onRunClick,
    onStopClick,
  };
}
