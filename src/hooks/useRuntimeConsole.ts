import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EngineLogLevel } from "@/engine/engine";
import type { FlowNode } from "@/utils/flow";

type RuntimePrompt = {
  nodeId: string;
  prompt: string;
  type: "number" | "text";
  defaultValue?: unknown;
  submit: (value: unknown) => void;
  cancel: () => void;
};

type UseRuntimeConsoleParams = {
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  isRuntimeUpdateRef: React.MutableRefObject<boolean>;
};

export function useRuntimeConsole({
  setNodes,
  isRuntimeUpdateRef,
}: UseRuntimeConsoleParams) {
  const [engineLogs, setEngineLogs] = useState<
    Array<{ ts: number; level: EngineLogLevel; nodeId?: string; text: string }>
  >([]);

  const [runtimePromptQueue, setRuntimePromptQueue] = useState<RuntimePrompt[]>(
    []
  );
  const [runtimePromptInput, setRuntimePromptInput] = useState<string>("");
  const consoleScrollRef = useRef<HTMLDivElement | null>(null);
  const consoleInputRef = useRef<HTMLTextAreaElement | null>(null);

  const stripPromptClass = useCallback((className?: string) => {
    if (!className) return "";
    return className
      .split(/\s+/g)
      .filter((c) => c && c !== "rf-node-prompt")
      .join(" ");
  }, []);

  const onClearConsoleClick = useCallback(() => {
    setEngineLogs([]);
  }, []);

  const consoleOutputText = useMemo(() => {
    return engineLogs.map((l) => l.text).join("\n");
  }, [engineLogs]);

  const activeRuntimePrompt = runtimePromptQueue[0] ?? null;

  useEffect(() => {
    const el = consoleScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [consoleOutputText]);

  useEffect(() => {
    if (activeRuntimePrompt == null) return;
    // Ensure focus after the panel is rendered.
    requestAnimationFrame(() => {
      consoleInputRef.current?.focus();
      consoleInputRef.current?.select();
    });
  }, [activeRuntimePrompt]);

  useEffect(() => {
    isRuntimeUpdateRef.current = true;
    setNodes((prev) =>
      prev.map((n) => {
        const base = stripPromptClass(n.className);
        if (!activeRuntimePrompt) {
          return { ...n, className: base };
        }
        if (String(n.id) !== String(activeRuntimePrompt.nodeId)) {
          return { ...n, className: base };
        }
        return { ...n, className: `${base} rf-node-prompt`.trim() };
      })
    );
  }, [activeRuntimePrompt, isRuntimeUpdateRef, setNodes, stripPromptClass]);

  const appendConsoleLines = useCallback(
    (lines: string[], opts?: { level?: EngineLogLevel; nodeId?: string }) => {
      const ts = Date.now();
      const level = opts?.level ?? "info";
      const nodeId = opts?.nodeId;
      setEngineLogs((prev) => {
        const next = [
          ...prev,
          ...lines.map((text, idx) => ({
            ts: ts + idx,
            level,
            nodeId,
            text,
          })),
        ];
        const MAX = 200;
        return next.length > MAX ? next.slice(next.length - MAX) : next;
      });
    },
    []
  );

  const getRuntimePromptText = useCallback(() => {
    if (!activeRuntimePrompt) return "";
    const fallback =
      activeRuntimePrompt.type === "text"
        ? "Ingrese un texto"
        : "Ingrese un número";
    return activeRuntimePrompt.prompt?.trim()
      ? activeRuntimePrompt.prompt.trim()
      : fallback;
  }, [activeRuntimePrompt]);

  const getRuntimePromptDefaultValue = useCallback(() => {
    if (!activeRuntimePrompt) return 0;
    const dv = activeRuntimePrompt.defaultValue;
    if (activeRuntimePrompt.type === "text") {
      if (typeof dv === "string") return dv;
      if (dv === null || dv === undefined) return "";
      return String(dv);
    }
    return typeof dv === "number" && Number.isFinite(dv) ? dv : 0;
  }, [activeRuntimePrompt]);

  const onCancelRuntimePrompt = useCallback(() => {
    if (activeRuntimePrompt != null) {
      appendConsoleLines([getRuntimePromptText(), "> ^C"], {
        nodeId: activeRuntimePrompt.nodeId,
      });
    }

    activeRuntimePrompt?.cancel();
    setRuntimePromptInput("");
    setRuntimePromptQueue((prev) => prev.slice(1));
  }, [activeRuntimePrompt, appendConsoleLines, getRuntimePromptText]);

  const onSubmitRuntimePrompt = useCallback(() => {
    if (!activeRuntimePrompt) return;

    const raw = runtimePromptInput;
    const trimmed = raw.trim();

    if (activeRuntimePrompt.type === "text") {
      const v = trimmed === "" ? getRuntimePromptDefaultValue() : raw;
      appendConsoleLines([getRuntimePromptText(), `> ${raw}`], {
        nodeId: activeRuntimePrompt.nodeId,
      });
      activeRuntimePrompt.submit(v);
      setRuntimePromptInput("");
      setRuntimePromptQueue((prev) => prev.slice(1));
      return;
    }

    const dv = getRuntimePromptDefaultValue();
    const n = trimmed === "" ? Number(dv) : Number(trimmed);
    if (!Number.isFinite(n)) {
      appendConsoleLines(
        ["Entrada inválida. Ingrese un número (ej: 10, 3.14, -2)."],
        { level: "error", nodeId: activeRuntimePrompt.nodeId }
      );
      return;
    }

    appendConsoleLines([getRuntimePromptText(), `> ${raw}`], {
      nodeId: activeRuntimePrompt.nodeId,
    });

    activeRuntimePrompt.submit(n);
    setRuntimePromptInput("");
    setRuntimePromptQueue((prev) => prev.slice(1));
  }, [
    activeRuntimePrompt,
    appendConsoleLines,
    getRuntimePromptDefaultValue,
    getRuntimePromptText,
    runtimePromptInput,
  ]);

  const enqueuePrompt = useCallback((prompt: RuntimePrompt) => {
    setRuntimePromptQueue((prev) => [...prev, prompt]);
  }, []);

  const clearPromptQueue = useCallback(() => {
    setRuntimePromptQueue((prev) => {
      for (const p of prev) p.cancel();
      return [];
    });
  }, []);

  return {
    consoleScrollRef,
    consoleInputRef,
    consoleOutputText,
    activeRuntimePrompt,
    runtimePromptInput,
    setRuntimePromptInput,
    onClearConsoleClick,
    onSubmitRuntimePrompt,
    onCancelRuntimePrompt,
    appendConsoleLines,
    enqueuePrompt,
    clearPromptQueue,
    getRuntimePromptText,
  };
}

export type { RuntimePrompt };
