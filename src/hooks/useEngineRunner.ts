import { useCallback, useRef, useState } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import {
  DataflowEngine,
  type EngineLogLevel,
  type EngineNodeStatus,
} from "@/engine/engine";
import { deserializeProgramToEngineStores } from "@/engine/deserialize-program";
import { serializeProgram } from "@/flow/serialization";
import type { FlowEdge, FlowNode } from "@/utils/flow";
import type { RuntimePrompt } from "@/hooks/useRuntimeConsole";

type UseEngineRunnerParams = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  programName: string;
  reactFlowInstance: ReactFlowInstance | null;
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  isRuntimeUpdateRef: React.MutableRefObject<boolean>;
  appendConsoleLines: (
    lines: string[],
    opts?: { level?: EngineLogLevel; nodeId?: string },
  ) => void;
  enqueuePrompt: (prompt: RuntimePrompt) => void;
  clearPromptQueue: () => void;
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
  appendConsoleLines,
  enqueuePrompt,
  clearPromptQueue,
  resolveSubflowTemplate,
  maxSubflowDepth = 32,
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
    if (typeof data === "string") return data;
    if (typeof data === "number" || typeof data === "boolean") {
      return String(data);
    }
    if (data instanceof Error) return data.message;
    try {
      return JSON.stringify(data);
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
      };

      const stores = deserializeProgramToEngineStores(program, {
        onLog: onLogHandler,
        onPrompt: onPromptHandler,
        signal: abortController.signal,
        resolveSubflowTemplate,
        maxSubflowDepth,
      });
      const engine = new DataflowEngine();

      engine.setObserver({
        onNodeStatus: ({ nodeId, status, error }) => {
          isRuntimeUpdateRef.current = true;
          const errorText =
            status === "error" && error !== undefined
              ? formatLogText(error)
              : undefined;
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
    appendConsoleLines,
    edges,
    enqueuePrompt,
    formatLogText,
    isEngineRunning,
    isRuntimeUpdateRef,
    nodes,
    programName,
    reactFlowInstance,
    runtimeClassForStatus,
    setAllNodesRuntimeState,
    setNodes,
    stripRuntimeClasses,
  ]);

  return {
    isEngineRunning,
    onRunClick,
    onStopClick,
  };
}
