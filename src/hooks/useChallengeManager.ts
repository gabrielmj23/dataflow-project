import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  loadChallengeDefinition,
  getChallengesByGroup,
  type ChallengeDefinition,
  type ChallengeConstraint,
  type ChallengeTestCase,
} from "@/challenges/definitions";
import { useChallengeProgress } from "@/challenges/progress-context";
import { DataflowEngine, type EngineLogLevel } from "@/engine/engine";
import { deserializeProgramToEngineStores } from "@/engine/deserialize-program";
import type { RemoteExecutor } from "@/engine/deserialize-program";
import { serializeProgram } from "@/flow/serialization";
import type { FlowEdge, FlowNode } from "@/utils/flow";

export type ValidationResult = {
  status: "idle" | "success" | "failure";
  message?: string;
  actualLines: string[];
};

export interface UseChallengeManagerParams {
  challengeId: string | undefined;
  nodes: FlowNode[];
  edges: FlowEdge[];
  programName: string;
  remoteExecutorRef: React.RefObject<RemoteExecutor | null>;
  resolveSubflowTemplate: (templateId: string) => {
    id: string;
    name: string;
    inCount: number;
    outCount: number;
    nodes: FlowNode[];
    edges: FlowEdge[];
  } | null;
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  setProgramName: React.Dispatch<React.SetStateAction<string>>;
  resetHistory: (snapshot: { nodes: FlowNode[]; edges: FlowEdge[] }) => void;
  onClearConsoleClick: () => void;
  clearPromptQueue: () => void;
  setIsConsoleOpen: React.Dispatch<React.SetStateAction<boolean>>;
  consoleOutputText: string;
}

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function formatLogText(data: unknown): string {
  const toEsBoolean = (v: boolean) => (v ? "Verdadero" : "Falso");
  const normalizeNumber = (n: number) => {
    const roundedInt = Math.round(n);
    if (Math.abs(n - roundedInt) < 1e-9) return roundedInt;
    return Math.round((n + Number.EPSILON) * 1000) / 1000;
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
      const entries = Object.entries(value).map(([k, v]) => [
        k,
        normalizeValue(v),
      ]);
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
}

function compareLines(
  expectedLines: string[],
  actualLines: string[],
  matchMode: "exact" | "contains" | "regex",
  caseInsensitive: boolean,
): boolean {
  if (matchMode === "contains") {
    return expectedLines.every((expected) =>
      actualLines.some((line) =>
        caseInsensitive
          ? line.toLowerCase().includes(expected.toLowerCase())
          : line.includes(expected),
      ),
    );
  }
  if (matchMode === "regex") {
    return expectedLines.every((pattern) => {
      try {
        const flags = caseInsensitive ? "i" : "";
        const regex = new RegExp(pattern, flags);
        return actualLines.some((line) => regex.test(line));
      } catch {
        return false;
      }
    });
  }
  if (expectedLines.length !== actualLines.length) return false;
  return expectedLines.every((line, idx) =>
    caseInsensitive
      ? line.toLowerCase() === actualLines[idx].toLowerCase()
      : line === actualLines[idx],
  );
}

export function useChallengeManager(params: UseChallengeManagerParams) {
  const {
    challengeId,
    nodes,
    edges,
    programName,
    remoteExecutorRef,
    resolveSubflowTemplate,
    setNodes,
    setEdges,
    setProgramName,
    resetHistory,
    onClearConsoleClick,
    clearPromptQueue,
    setIsConsoleOpen,
    consoleOutputText,
  } = params;

  const navigate = useNavigate();
  const { progress, markCompleted } = useChallengeProgress();

  const [challengeDefinition, setChallengeDefinition] =
    useState<ChallengeDefinition | null>(null);
  const [isChallengeLoading, setIsChallengeLoading] = useState(false);
  const [, setChallengeError] = useState<string | null>(null);

  const [validationResult, setValidationResult] = useState<ValidationResult>({
    status: "idle",
    actualLines: [],
  });
  const [shouldCelebrate, setShouldCelebrate] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isChallengeOpen, setIsChallengeOpen] = useState(true);
  const [isLevelCompleteDialogOpen, setIsLevelCompleteDialogOpen] =
    useState(false);

  const latestConsoleLines = useMemo(
    () => normalizeLines(consoleOutputText),
    [consoleOutputText],
  );

  const expectedOutputLines = useMemo(() => {
    if (!challengeDefinition) return [] as string[];
    return (challengeDefinition.grading.expectedConsole ?? [])
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);
  }, [challengeDefinition]);

  const nextChallenge = useMemo(() => {
    if (!challengeDefinition) return null;
    const groupChallenges = getChallengesByGroup(challengeDefinition.group);
    const sorted = [...groupChallenges].sort((a, b) => a.level - b.level);
    const currentIndex = sorted.findIndex(
      (ch) => ch.id === challengeDefinition.id,
    );
    if (currentIndex === -1 || currentIndex === sorted.length - 1) return null;
    return sorted[currentIndex + 1];
  }, [challengeDefinition]);

  const challengeAllowSet = useMemo(() => {
    if (!challengeDefinition) return null;
    return new Set(challengeDefinition.constraints.paletteAllowList);
  }, [challengeDefinition]);

  const onNextChallengeClick = useCallback(() => {
    if (nextChallenge) {
      navigate(`/editor/${nextChallenge.id}`);
    } else {
      navigate("/");
    }
  }, [navigate, nextChallenge]);

  const runTestCase = useCallback(
    async (testCase: ChallengeTestCase, opts: { caseInsensitive: boolean }) => {
      const program = serializeProgram({ nodes, edges, programName }, false);

      const actualLinesRaw: string[] = [];
      let promptIndex = 0;

      const onLog = ({
        level,
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
        actualLinesRaw.push(text);
      };

      const onPrompt = ({
        type,
        defaultValue,
        submit,
      }: {
        nodeId: string;
        prompt: string;
        type: "number" | "text";
        defaultValue?: unknown;
        submit: (value: unknown) => void;
        cancel: () => void;
      }) => {
        const value = (testCase.inputs ?? [])[promptIndex++] ?? "";
        if (type === "number") {
          const n = Number(value);
          submit(Number.isFinite(n) ? n : Number(defaultValue ?? 0));
        } else {
          submit(value);
        }
      };

      const stores = deserializeProgramToEngineStores(program, {
        onLog,
        onPrompt,
        signal: new AbortController().signal,
        remoteExecutor: remoteExecutorRef.current ?? undefined,
        resolveSubflowTemplate,
        maxSubflowDepth: 1000,
      });

      const engine = new DataflowEngine();
      engine.setObserver({ onLog, onPrompt });
      engine.loadProgram({
        nodes: stores.nodeStore.getNodes(),
        arcs: stores.arcStore.getArcs(),
      });

      await engine.run({ initialTokens: [], maxSteps: 10_000 });

      const actualLines = normalizeLines(actualLinesRaw.join("\n"));
      const expectedLines = normalizeLines(testCase.expected.join("\n"));

      const matchMode = challengeDefinition?.grading.matchMode ?? "exact";
      const matches = compareLines(
        expectedLines,
        actualLines,
        matchMode,
        opts.caseInsensitive,
      );

      return { matches, actualLines } as const;
    },
    [
      nodes,
      edges,
      programName,
      remoteExecutorRef,
      resolveSubflowTemplate,
      challengeDefinition?.grading.matchMode,
    ],
  );

  const validateChallengeOutput = useCallback(async () => {
    if (!challengeDefinition) return;

    setIsConsoleOpen(true);
    setIsValidating(true);

    const matchMode = challengeDefinition.grading.matchMode ?? "exact";
    const caseInsensitive = challengeDefinition.grading.caseInsensitive ?? true;

    const testCases = challengeDefinition.grading.testCases;

    if (testCases && testCases.length > 0) {
      try {
        let lastResult = { matches: true, actualLines: [] as string[] };

        for (let i = 0; i < testCases.length; i++) {
          const tc = testCases[i];
          const result = await runTestCase(tc, { caseInsensitive });
          lastResult = result;
          if (!result.matches) {
            setValidationResult({
              status: "failure",
              message: `Falló el caso "${tc.name ?? `Caso ${i + 1}`}". Ajusta tu flujo y vuelve a intentar.`,
              actualLines: result.actualLines,
            });
            setIsValidating(false);
            return;
          }
        }

        setValidationResult({
          status: "success",
          message: "¡Correcto! Todas las pruebas pasaron.",
          actualLines: lastResult.actualLines,
        });
        if (!progress.completedIds.includes(challengeDefinition.id)) {
          setShouldCelebrate(true);
        }
        markCompleted(challengeDefinition.id);
        if (!nextChallenge) {
          setIsLevelCompleteDialogOpen(true);
        }
      } catch {
        setValidationResult({
          status: "failure",
          message: "No se pudo ejecutar las pruebas automáticas.",
          actualLines: [],
        });
      }
      setIsValidating(false);
      return;
    }

    const actualLines = latestConsoleLines;

    if (!actualLines.length) {
      setValidationResult({
        status: "failure",
        message: "Aún no hay salida en la consola para validar.",
        actualLines,
      });
      setIsValidating(false);
      return;
    }

    const matches = compareLines(
      expectedOutputLines,
      actualLines,
      matchMode,
      caseInsensitive,
    );

    if (matches) {
      if (!progress.completedIds.includes(challengeDefinition.id)) {
        setShouldCelebrate(true);
      }
      markCompleted(challengeDefinition.id);
      if (!nextChallenge) {
        setIsLevelCompleteDialogOpen(true);
      }
    }
    setValidationResult({
      status: matches ? "success" : "failure",
      message: matches
        ? "¡Correcto! La salida coincide con lo esperado."
        : "La salida no es correcta. Revisa tus conexiones y vuelve a intentar.",
      actualLines,
    });

    setIsValidating(false);
  }, [
    challengeDefinition,
    expectedOutputLines,
    latestConsoleLines,
    markCompleted,
    runTestCase,
    progress.completedIds,
    nextChallenge,
    setIsConsoleOpen,
  ]);

  // Load challenge definition when challengeId changes
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!challengeId) {
        setChallengeDefinition(null);
        setChallengeError(null);
        setValidationResult({ status: "idle", actualLines: [] });
        setIsChallengeLoading(false);
        return;
      }

      setIsChallengeLoading(true);
      setChallengeError(null);

      try {
        const definition = await loadChallengeDefinition(challengeId);
        if (cancelled) return;
        setIsChallengeLoading(false);

        if (!definition) {
          setChallengeDefinition(null);
          setChallengeError("No se encontró el desafío solicitado.");
          return;
        }

        const lockedNodesSource = definition.constraints.lockedNodes ?? [];
        const lockedNodes = lockedNodesSource.map<FlowNode>(
          (
            node: NonNullable<ChallengeConstraint["lockedNodes"]>[number],
            index: number,
          ) => ({
            id: node.id || `locked-${index + 1}`,
            type: node.type,
            position: node.position,
            data: { ...(node.data ?? {}), locked: true },
            draggable: node.movable === true,
            deletable: false,
            selectable: true,
          }),
        );

        const initialNodes = [
          ...(definition.constraints.initialNodes ?? []),
          ...lockedNodes,
        ];
        const initialEdges = definition.constraints.initialEdges ?? [];

        setChallengeDefinition(definition);
        setProgramName(definition.title);
        setNodes(initialNodes);
        setEdges(initialEdges);
        resetHistory({ nodes: initialNodes, edges: initialEdges });
        setValidationResult({ status: "idle", actualLines: [] });
        try {
          onClearConsoleClick();
        } catch {
          /* ignore */
        }
        try {
          clearPromptQueue();
        } catch {
          /* ignore */
        }
        try {
          setIsConsoleOpen(false);
        } catch {
          /* ignore */
        }
      } catch (error) {
        if (cancelled) return;
        setIsChallengeLoading(false);
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo cargar el desafío.";
        setChallengeError(message);
        setChallengeDefinition(null);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    challengeId,
    resetHistory,
    setEdges,
    setNodes,
    setProgramName,
    onClearConsoleClick,
    clearPromptQueue,
    setIsConsoleOpen,
  ]);

  useEffect(() => {
    setShouldCelebrate(false);
  }, [challengeDefinition?.id]);

  useEffect(() => {
    if (!shouldCelebrate) return;
    const id = window.setTimeout(() => setShouldCelebrate(false), 20000);
    return () => window.clearTimeout(id);
  }, [shouldCelebrate]);

  useEffect(() => {
    if (!challengeDefinition) return;
    if (!progress.completedIds.includes(challengeDefinition.id)) return;
    setValidationResult((prev) =>
      prev.status === "success"
        ? prev
        : {
            status: "success",
            message: "Desafío ya completado.",
            actualLines: [],
          },
    );
  }, [challengeDefinition, progress.completedIds]);

  useEffect(() => {
    if (!challengeDefinition) return;
    const prereqs = challengeDefinition.prerequisites ?? [];
    if (prereqs.length === 0) return;
    const hasAll = prereqs.every((id) => progress.completedIds.includes(id));
    if (!hasAll) {
      navigate("/desafios");
    }
  }, [challengeDefinition, navigate, progress.completedIds]);

  return {
    challengeDefinition,
    isChallengeLoading,
    validationResult,
    shouldCelebrate,
    isValidating,
    isChallengeOpen,
    setIsChallengeOpen,
    isLevelCompleteDialogOpen,
    setIsLevelCompleteDialogOpen,
    validateChallengeOutput,
    nextChallenge,
    onNextChallengeClick,
    challengeAllowSet,
    navigate,
  };
}
