import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  MarkerType,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ControlButton,
  SelectionMode,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "@/App.css";
import { Hand, MousePointer2, BrushCleaning, ChevronDown, ChevronUp } from "lucide-react";
import AppHeader from "@/components/app-header";
import { nodeTypes } from "@/flow/node-types";
import { LabeledEdge } from "@/flow/labeled-edge";
import { ArrowConnectionLine } from "@/flow/arrow-connection-line";
import { ConnectionErrorTooltip } from "@/flow/connection-error-tooltip";
import { ConnectionHighlightProvider } from "@/flow/connection-highlight-context";
import { AppSidebar } from "@/components/app-sidebar";
import { CanvasContextMenu } from "@/components/CanvasContextMenu";
import { ConsolePanel } from "@/components/ConsolePanel";
import { CreateSubflowDialog } from "@/components/CreateSubflowDialog";
import { DeleteSubflowDialog } from "@/components/DeleteSubflowDialog";
import { TopBar } from "@/components/TopBar";
import { TopActionPanel } from "@/components/TopActionPanel";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { usePaletteDrag } from "@/hooks/usePaletteDrag";
import { SubflowTemplateContext } from "@/flow/subflow-templates-context";
import { useEngineRunner } from "@/hooks/useEngineRunner";
import { createNodeId } from "@/utils/id";
import { useFlowHistory } from "@/hooks/useFlowHistory";
import { useProgramIO } from "@/hooks/useProgramIO";
import { useRuntimeConsole } from "@/hooks/useRuntimeConsole";
import { useConnections } from "@/hooks/useConnections";
import { useClipboardSelection } from "@/hooks/useClipboardSelection";
import { useWriteNodeReconciliation } from "@/hooks/useWriteNodeReconciliation";
import { useSubflowTemplates } from "@/hooks/useSubflowTemplates";
import { useWsRunnerBridge } from "@/hooks/useWsRunnerBridge";
import { RemoteControllerPanel } from "@/components/RemoteControllerPanel";
import { RemoteSettingsDialog } from "@/components/RemoteSettingsDialog";
import type { EngineRunnerEvent } from "@/hooks/useEngineRunner";
import { useRemoteConfigState } from "@/hooks/useRemoteConfig";
import type { RemoteExecutor } from "@/engine/deserialize-program";
import { RemoteControllersProvider } from "@/ws/remote-controllers-context";
import {
  loadChallengeDefinition,
  type ChallengeDefinition,
} from "@/challenges/definitions";
import type { NodePaletteItem } from "@/flow/node-palette";
import {
  type FlowBounds,
  type FlowEdge,
  type FlowNode,
  type SubflowSnapshot,
} from "@/utils/flow";
import { getLayoutedElements } from "@/utils/layout";
import {
  CreateSubflowOverlay,
  type CreateSubflowRequest,
} from "@/components/CreateSubflowOverlay";

type SubflowPorts = { inCount: number; outCount: number };

const initialNodes: FlowNode[] = [];

const initialEdges: FlowEdge[] = [];

export default function EditorPage() {
  const { challengeId } = useParams<{ challengeId?: string }>();

  const {
    config: remoteConfig,
    setConfig: setRemoteConfig,
    resetConfig,
  } = useRemoteConfigState();

  const [isRemoteDialogOpen, setIsRemoteDialogOpen] = useState(false);

  const [challengeDefinition, setChallengeDefinition] =
    useState<ChallengeDefinition | null>(null);
  const [isChallengeLoading, setIsChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    status: "idle" | "success" | "failure";
    message?: string;
    actualLines: string[];
  }>({ status: "idle", actualLines: [] });
  const [isValidating, setIsValidating] = useState(false);
  const [isChallengeOpen, setIsChallengeOpen] = useState(true);

  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [contextPoint, setContextPoint] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [canvasMode, setCanvasMode] = useState<"pan" | "select">("pan");
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);

  const {
    subflowTemplates,
    addOrUpdateTemplate,
    isNameTaken,
    resolveTemplate,
    deleteTemplate,
  } = useSubflowTemplates();

  const [programName, setProgramName] = useState<string>("Sin título");

  const isRuntimeUpdateRef = useRef(false);
  const {
    undo,
    redo,
    onNodeDragStart,
    onNodeDragStop,
    isRestoringRef,
    isDraggingRef,
    resetHistory,
  } = useFlowHistory({
    nodes,
    edges,
    setNodes,
    setEdges,
    initialNodes,
    initialEdges,
    isRuntimeUpdateRef,
  });
  const { copySelection, pasteSelection, onPaneMouseMove } =
    useClipboardSelection({
      nodes,
      edges,
      setNodes,
      setEdges,
      reactFlowInstance,
    });
  const {
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
  } = useRuntimeConsole({
    setNodes,
    isRuntimeUpdateRef,
  });

  const normalizeLines = useCallback((text: string) => {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, []);

  const latestConsoleLines = useMemo(
    () => normalizeLines(consoleOutputText),
    [consoleOutputText, normalizeLines],
  );

  const expectedOutputLines = useMemo(() => {
    if (!challengeDefinition) return [] as string[];
    return (challengeDefinition.grading.expectedConsole ?? [])
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }, [challengeDefinition]);

  // Engine event sink that can be wired to the WS runner bridge without
  // creating hook ordering cycles.
  const engineEventSinkRef = useRef<
    ((event: EngineRunnerEvent) => void) | null
  >(null);
  const remoteExecutorRef = useRef<RemoteExecutor | null>(null);
  const onEngineEvent = useCallback((event: EngineRunnerEvent) => {
    engineEventSinkRef.current?.(event);
  }, []);
  const remoteExecutor = useCallback<RemoteExecutor>((req) => {
    if (!remoteExecutorRef.current) {
      return Promise.reject(new Error("Remote executor no disponible."));
    }
    return remoteExecutorRef.current(req);
  }, []);

  const { isEngineRunning, onRunClick, onStopClick } = useEngineRunner({
    nodes,
    edges,
    programName,
    reactFlowInstance,
    setNodes,
    isRuntimeUpdateRef,
    appendConsoleLines,
    enqueuePrompt,
    clearPromptQueue,
    onEngineEvent,
    remoteExecutor,
    resolveSubflowTemplate: resolveTemplate,
    maxSubflowDepth: 1000,
  });

  const runnerBridge = useWsRunnerBridge({
    remoteConfig,
    nodes,
    programName,
    isEngineRunning,
    consoleOutputText,
    activeRuntimePrompt,
    onRunClick,
    onStopClick,
  });

  useEffect(() => {
    engineEventSinkRef.current = runnerBridge.emitEngineEvent;
    remoteExecutorRef.current = runnerBridge.executeRemote;
  }, [runnerBridge.emitEngineEvent, runnerBridge.executeRemote]);

  const handleRunClick = useCallback(() => {
    setIsConsoleOpen(true);
    return onRunClick();
  }, [onRunClick]);

  const validateChallengeOutput = useCallback(() => {
    if (!challengeDefinition) return;

    setIsConsoleOpen(true);
    setIsValidating(true);

    const expectedLines = expectedOutputLines;

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

    const matchMode = challengeDefinition.grading.matchMode ?? "exact";

    const matches = (() => {
      if (matchMode === "contains") {
        return expectedLines.every((expected) =>
          actualLines.some((line) => line.includes(expected)),
        );
      }
      if (matchMode === "regex") {
        return expectedLines.every((pattern) => {
          try {
            const regex = new RegExp(pattern);
            return actualLines.some((line) => regex.test(line));
          } catch {
            return false;
          }
        });
      }

      if (expectedLines.length !== actualLines.length) return false;
      return expectedLines.every((line, idx) => line === actualLines[idx]);
    })();

    setValidationResult({
      status: matches ? "success" : "failure",
      message: matches
        ? "¡Correcto! La salida coincide con lo esperado."
        : "Aún no coincide con la salida esperada.",
      actualLines,
    });

    setIsValidating(false);
  }, [challengeDefinition, expectedOutputLines, latestConsoleLines]);

  const {
    paletteCategories: basePaletteCategories,
    onPaletteDragStart: onPaletteDragStartInternal,
    onDragOver,
    onDrop,
  } = usePaletteDrag({ reactFlowInstance, setNodes, setEdges, subflowTemplates });

  const challengeAllowSet = useMemo(() => {
    if (!challengeDefinition) return null;
    return new Set(challengeDefinition.constraints.paletteAllowList);
  }, [challengeDefinition]);

  const paletteCategories = useMemo(() => {
    if (!challengeAllowSet) return basePaletteCategories;

    return basePaletteCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => challengeAllowSet.has(item.type)),
      }))
      .filter((category) => category.items.length > 0);
  }, [basePaletteCategories, challengeAllowSet]);

  const onPaletteDragStart = useCallback(
    (event: React.DragEvent, item: NodePaletteItem) => {
      if (challengeAllowSet && !challengeAllowSet.has(item.type)) return;
      onPaletteDragStartInternal(event, item);
    },
    [challengeAllowSet, onPaletteDragStartInternal],
  );

  const selectedNodes = useMemo(
    () => nodes.filter((node) => node.selected),
    [nodes],
  );

  const [isCreateSubflowOpen, setIsCreateSubflowOpen] = useState(false);
  const [subflowName, setSubflowName] = useState("");
  const [pendingSubflowBounds, setPendingSubflowBounds] =
    useState<FlowBounds | null>(null);
  const [pendingSubflowPorts, setPendingSubflowPorts] =
    useState<SubflowPorts | null>(null);
  const [pendingSubflowSnapshot, setPendingSubflowSnapshot] =
    useState<SubflowSnapshot | null>(null);
  const [createSubflowError, setCreateSubflowError] = useState<string | null>(
    null,
  );
  const [createSubflowNameError, setCreateSubflowNameError] = useState<
    string | null
  >(null);
  const [addSubflowToPalette, setAddSubflowToPalette] = useState(false);
  const [pendingDeleteTemplateId, setPendingDeleteTemplateId] = useState<
    string | null
  >(null);
  const [pendingDeleteTemplateName, setPendingDeleteTemplateName] = useState<
    string | null
  >(null);

  const { fileInputRef, onDownloadClick, onLoadClick, onProgramFileChange } =
    useProgramIO({
      reactFlowInstance,
      programName,
      setNodes,
      setEdges,
      setProgramName,
    });

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

        const lockedNodes = (definition.constraints.lockedNodes ?? []).map<
          FlowNode
        >((node, index) => ({
          id: node.id || `locked-${index + 1}`,
          type: node.type,
          position: node.position,
          data: { ...(node.data ?? {}), locked: true },
          draggable: node.movable === true,
          deletable: false,
          selectable: true,
        }));

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
  }, [challengeId, resetHistory, setEdges, setNodes, setProgramName]);

  const onCreateSubflowDialogChange = useCallback((open: boolean) => {
    setIsCreateSubflowOpen(open);
    if (!open) {
      setPendingSubflowBounds(null);
      setPendingSubflowPorts(null);
      setPendingSubflowSnapshot(null);
      setCreateSubflowError(null);
      setCreateSubflowNameError(null);
      setAddSubflowToPalette(false);
    }
  }, []);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nodesSnapshot) => {
      const lockedNodeIds = new Set(
        nodesSnapshot
          .filter((node) => {
            const data =
              node.data && typeof node.data === "object"
                ? (node.data as Record<string, unknown>)
                : null;
            return data?.locked === true || node.deletable === false;
          })
          .map((node) => String(node.id)),
      );

      const filteredChanges = changes.filter((change) => {
        if (change.type !== "remove") return true;
        return !lockedNodeIds.has(String(change.id));
      });

      const removedChanges = filteredChanges.filter(
        (change) => change.type === "remove",
      );
      let expandedChanges = filteredChanges;

      if (removedChanges.length > 0) {
        const removedIds = new Set(
          removedChanges.map((change) => String(change.id)),
        );
        const removedPairIds = new Set<string>();

        for (const node of nodesSnapshot) {
          const nodeId = String(node.id);
          if (!removedIds.has(nodeId)) continue;

          const data =
            node.data && typeof node.data === "object"
              ? (node.data as Record<string, unknown>)
              : null;
          const pairId = data?.pairId ? String(data.pairId) : null;
          if (pairId) removedPairIds.add(pairId);
        }

        if (removedPairIds.size > 0) {
          for (const node of nodesSnapshot) {
            const data =
              node.data && typeof node.data === "object"
                ? (node.data as Record<string, unknown>)
                : null;
            const pairId = data?.pairId ? String(data.pairId) : null;
            if (pairId && removedPairIds.has(pairId)) {
              removedIds.add(String(node.id));
            }
          }

          expandedChanges = filteredChanges.concat(
            Array.from(removedIds)
              .filter((id) =>
                !removedChanges.some((c) => String(c.id) === id),
              )
              .map((id) => ({ type: "remove", id }) as NodeChange),
          );

          setEdges((edgesSnapshot) =>
            edgesSnapshot.filter((edge) => {
              const data =
                edge.data && typeof edge.data === "object"
                  ? (edge.data as Record<string, unknown>)
                  : null;
              const edgePairId = data?.pairId ? String(data.pairId) : null;
              if (edgePairId && removedPairIds.has(edgePairId)) return false;
              if (
                removedIds.has(String(edge.source)) ||
                removedIds.has(String(edge.target))
              ) {
                return false;
              }
              return true;
            }),
          );
        }
      }

      const next = applyNodeChanges(expandedChanges, nodesSnapshot);

      const movedIds = new Set(
        expandedChanges
          .filter((change) => change.type === "position")
          .map((change) => String(change.id)),
      );

      if (movedIds.size === 0) return next;

      const pairs = new Map<
        string,
        { conditional?: FlowNode; selector?: FlowNode; offset: number }
      >();

      for (const node of next) {
        const data =
          node.data && typeof node.data === "object"
            ? (node.data as Record<string, unknown>)
            : null;
        const pairId = data?.pairId ? String(data.pairId) : null;
        if (!pairId) continue;

        const role = data?.pairRole ? String(data.pairRole) : null;
        const offsetRaw = data?.pairOffsetY;
        const offset = Number.isFinite(Number(offsetRaw))
          ? Number(offsetRaw)
          : 160;

        const entry = pairs.get(pairId) ?? { offset };
        entry.offset = offset;
        if (role === "conditional") entry.conditional = node;
        if (role === "selector") entry.selector = node;
        pairs.set(pairId, entry);
      }

      if (pairs.size === 0) return next;

      const overrides = new Map<string, { x: number; y: number }>();

      for (const [, pair] of pairs.entries()) {
        const conditional = pair.conditional;
        const selector = pair.selector;
        if (!conditional || !selector) continue;

        const conditionalMoved = movedIds.has(String(conditional.id));
        const selectorMoved = movedIds.has(String(selector.id));
        if (!conditionalMoved && !selectorMoved) continue;

        const offset = pair.offset;

        if (conditionalMoved) {
          overrides.set(String(selector.id), {
            x: conditional.position.x,
            y: conditional.position.y + offset,
          });
        } else if (selectorMoved) {
          overrides.set(String(conditional.id), {
            x: selector.position.x,
            y: selector.position.y - offset,
          });
        }
      }

      if (overrides.size === 0) return next;

      return next.map((node) => {
        const nextPos = overrides.get(String(node.id));
        if (!nextPos) return node;
        return {
          ...node,
          position: nextPos,
        } as FlowNode;
      });
    });
  }, []);
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => {
        const lockedEdgeIds = new Set(
          edgesSnapshot
            .filter(
              (edge) =>
                edge.data &&
                typeof edge.data === "object" &&
                (edge.data as { locked?: unknown }).locked === true,
            )
            .map((edge) => String(edge.id)),
        );

        const filteredChanges = changes.filter((change) => {
          if (change.type !== "remove") return true;
          return !lockedEdgeIds.has(String(change.id));
        });

        return applyEdgeChanges(filteredChanges, edgesSnapshot);
      }),
    [],
  );

  const {
    connectionTooltip,
    connectionHighlight,
    onConnectStart,
    onConnectEnd,
    onConnect,
  } = useConnections({ nodes, setNodes, setEdges });

  // Keep WriteNode dynamic inputs in sync with actual connections.
  // - On deletions that create gaps (e.g. in-1, in-3), compact indices (→ in-1, in-2)
  // - Shrink inputCount to connectedCount+1 (keep one empty handle)
  // - Remap/remove {k} placeholders accordingly
  useWriteNodeReconciliation({
    edges,
    setNodes,
    setEdges,
    isRestoringRef,
    isRuntimeUpdateRef,
    isDraggingRef,
  });

  const addCommentAtContext = useCallback(() => {
    if (!reactFlowInstance) return;
    if (!contextPoint) return;

    const instance = reactFlowInstance as
      | (ReactFlowInstance & {
          screenToFlowPosition?: (pos: { x: number; y: number }) => {
            x: number;
            y: number;
          };
          project?: (pos: { x: number; y: number }) => {
            x: number;
            y: number;
          };
        })
      | null;

    const screenPos = { x: contextPoint.x, y: contextPoint.y };
    const position = instance?.screenToFlowPosition?.(screenPos) ??
      instance?.project?.(screenPos) ?? { x: 0, y: 0 };

    const newNode: FlowNode = {
      id: createNodeId(),
      type: "comment",
      position,
      data: { text: "" },
    };

    setNodes((prev) => [...prev, newNode]);
    setContextPoint(null);
  }, [reactFlowInstance, contextPoint, setNodes]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const key = e.key.toLowerCase();
      const hasCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isTextInput) {
        return;
      }

      if (hasCtrlOrMeta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (hasCtrlOrMeta && key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (hasCtrlOrMeta && key === "c") {
        e.preventDefault();
        copySelection();
        return;
      }

      if (hasCtrlOrMeta && key === "v") {
        e.preventDefault();
        pasteSelection();
        return;
      }

      if (e.key !== "Delete" && e.key !== "Backspace") return;

      setNodes((prevNodes) => {
        const lockedNodeIds = new Set(
          prevNodes
            .filter((node) => {
              const data =
                node.data && typeof node.data === "object"
                  ? (node.data as Record<string, unknown>)
                  : null;
              return data?.locked === true || node.deletable === false;
            })
            .map((node) => String(node.id)),
        );

        const removable = prevNodes.filter(
          (node) => node.selected && !lockedNodeIds.has(String(node.id)),
        );

        const removedIds = new Set(removable.map((n) => n.id));

        const nextNodes = prevNodes.filter(
          (node) => !removedIds.has(String(node.id)),
        );

        setEdges((prevEdges) =>
          prevEdges.filter((edge) => {
            const data =
              edge.data && typeof edge.data === "object"
                ? (edge.data as Record<string, unknown>)
                : null;
            const locked = data?.locked === true;
            const notDeletable = edge.deletable === false;

            // If either endpoint node is being removed, always drop the edge.
            const src = String((edge as Edge).source);
            const tgt = String((edge as Edge).target);
            if (removedIds.has(src) || removedIds.has(tgt)) return false;

            // If the edge itself is selected, only allow removal when it is deletable.
            if ((edge as Edge).selected) {
              if (locked || notDeletable) return true;
              return false;
            }

            return true;
          }),
        );

        return nextNodes;
      });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [copySelection, pasteSelection, redo, undo, setNodes, setEdges]);

  const openCreateSubflow = useCallback((request: CreateSubflowRequest) => {
    setPendingSubflowBounds(request.bounds);
    setSubflowName("");
    if (request.ok) {
      setPendingSubflowPorts(request.ports);
      setPendingSubflowSnapshot(request.snapshot);
      setCreateSubflowError(null);
      setCreateSubflowNameError(null);
    } else {
      setPendingSubflowPorts(null);
      setPendingSubflowSnapshot(null);
      setCreateSubflowError(request.message);
      setCreateSubflowNameError(null);
    }
    setIsCreateSubflowOpen(true);
  }, []);

  const createSubflow = useCallback(() => {
    const name = subflowName.trim();
    if (
      !name ||
      !pendingSubflowBounds ||
      !pendingSubflowPorts ||
      !pendingSubflowSnapshot
    ) {
      return;
    }

    if (addSubflowToPalette && isNameTaken(name)) {
      setCreateSubflowNameError(
        "Ya existe un subflujo en la paleta con ese nombre. Elige otro nombre.",
      );
      return;
    }

    setCreateSubflowNameError(null);

    const maxIndex = nodes.reduce((max, n) => {
      const match = String(n.id).match(/^sf-(\d+)$/);
      const idx = match ? parseInt(match[1] ?? "0", 10) : 0;
      return Math.max(max, idx);
    }, 0);
    const next = maxIndex + 1;

    const x = pendingSubflowBounds.x + pendingSubflowBounds.width / 2 - 72;
    const y = pendingSubflowBounds.y - 90;

    const templateId = `sf-${next}`;

    setNodes((prev) => {
      const newNode: FlowNode = {
        id: templateId,
        position: {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
        },
        data: {
          label: name,
          inCount: pendingSubflowPorts.inCount,
          outCount: pendingSubflowPorts.outCount,
          subflowNodes: pendingSubflowSnapshot.nodes,
          subflowEdges: pendingSubflowSnapshot.edges,
          templateId,
        },
        type: "subflow",
      };

      // Remove original selected nodes from main canvas
      const removedIds = new Set(
        pendingSubflowSnapshot.nodes.map((n) => String(n.id)),
      );

      const remaining = prev.filter((n) => !removedIds.has(String(n.id)));

      return [...remaining, newNode];
    });
    if (addSubflowToPalette) {
      addOrUpdateTemplate({
        id: templateId,
        name,
        inCount: pendingSubflowPorts.inCount,
        outCount: pendingSubflowPorts.outCount,
        nodes: pendingSubflowSnapshot.nodes,
        edges: pendingSubflowSnapshot.edges,
      });
    }

    // Remove any edges connected to the removed nodes
    setEdges((prevEdges) =>
      prevEdges.filter((e) => {
        const src = String(e.source);
        const tgt = String(e.target);
        return (
          !pendingSubflowSnapshot.nodes.some((n) => String(n.id) === src) &&
          !pendingSubflowSnapshot.nodes.some((n) => String(n.id) === tgt)
        );
      }),
    );

    setIsCreateSubflowOpen(false);
    setPendingSubflowBounds(null);
    setPendingSubflowPorts(null);
    setPendingSubflowSnapshot(null);
  }, [
    addSubflowToPalette,
    addOrUpdateTemplate,
    isNameTaken,
    nodes,
    pendingSubflowBounds,
    pendingSubflowPorts,
    pendingSubflowSnapshot,
    setNodes,
    subflowName,
  ]);

  const onLayout = useCallback(() => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
    );
    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [nodes, edges]);

  const [sidebarTop, setSidebarTop] = useState<number | null>(64);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(
        "[data-app-header]",
      ) as HTMLElement | null;
      if (el) setSidebarTop(Math.ceil(el.getBoundingClientRect().height));
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    const el = document.querySelector(
      "[data-app-header]",
    ) as HTMLElement | null;
    if (el) ro.observe(el);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, []);

  return (
    <RemoteControllersProvider controllers={runnerBridge.controllers}>
      <SidebarProvider>
        <div
          className="flex h-svh w-full flex-col"
          style={
            {
              ...(sidebarTop
                ? { "--sidebar-top": `${Math.max(0, sidebarTop)}px` }
                : {}),
            } as React.CSSProperties
          }
        >
          <AppHeader
            nodesCount={nodes.length}
            onDownload={onDownloadClick}
            onLoad={onLoadClick}
            onOpenRemoteConfig={() => setIsRemoteDialogOpen(true)}
            centerTitle={challengeDefinition?.title}
          />

          <div className="flex flex-1 min-h-0">
            <AppSidebar
              categories={paletteCategories}
              onDragStart={onPaletteDragStart}
              onDeleteTemplate={(templateId) => {
                const match = subflowTemplates.find(
                  (tpl) => tpl.id === templateId,
                );
                setPendingDeleteTemplateId(templateId);
                setPendingDeleteTemplateName(match ? match.name : null);
              }}
            />

            <SidebarInset>
              <div className="relative flex h-full w-full flex-col">
                <TopBar
                  programName={programName}
                  onProgramNameChange={setProgramName}
                />

                <div className="relative flex flex-1 min-h-0">
                  <div className="relative flex-1">
                    <RemoteSettingsDialog
                      config={remoteConfig}
                      onChange={setRemoteConfig}
                      onReset={resetConfig}
                      open={isRemoteDialogOpen}
                      setOpen={setIsRemoteDialogOpen}
                    />

                    {remoteConfig.role === "controller" ? (
                      <RemoteControllerPanel remoteConfig={remoteConfig} />
                    ) : null}

                    <SubflowTemplateContext.Provider
                      value={{
                        addOrUpdateTemplate,
                        isNameTaken,
                        resolveTemplate,
                      }}
                    >
                      <ConnectionHighlightProvider value={connectionHighlight}>
                        <CanvasContextMenu
                          onContextMenu={(e: React.MouseEvent) => {
                            setContextPoint({ x: e.clientX, y: e.clientY });
                          }}
                          onAddComment={addCommentAtContext}
                          copySelection={copySelection}
                          pasteSelection={pasteSelection}
                        >
                          <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={nodeTypes}
                            edgeTypes={{ default: LabeledEdge }}
                            connectionLineComponent={ArrowConnectionLine}
                            isValidConnection={
                              connectionTooltip.isValidConnection
                            }
                            defaultEdgeOptions={{
                              markerEnd: {
                                type: MarkerType.ArrowClosed,
                                width: 14,
                                height: 14,
                              },
                            }}
                            onInit={setReactFlowInstance}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onConnectStart={onConnectStart}
                            onConnectEnd={onConnectEnd}
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                            onNodeDragStart={onNodeDragStart}
                            onNodeDragStop={onNodeDragStop}
                            onPaneMouseMove={onPaneMouseMove}
                            panOnDrag={canvasMode === "pan"}
                            selectionOnDrag={canvasMode === "select"}
                            selectionMode={SelectionMode.Partial}
                            className={
                              canvasMode === "pan"
                                ? "rf-mode-pan"
                                : "rf-mode-select"
                            }
                            fitView
                            proOptions={{ hideAttribution: true }}
                          >
                            {challengeDefinition ? (
                              <div className="pointer-events-none absolute right-4 top-16 z-20 flex w-72 px-2">
                                <div className="pointer-events-auto grid w-full grid-cols-1 gap-0 rounded-2xl border border-white/70 bg-white/95 text-slate-900 shadow-lg max-w-xs overflow-hidden">
                                  <div className="flex items-center justify-between border-b border-[var(--nodi-blue-border)] bg-[var(--nodi-blue)] px-3 py-2 text-sm font-medium text-white">
                                    <div className="flex items-center gap-2">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="hover:bg-white/10"
                                        onClick={() => setIsChallengeOpen((s) => !s)}
                                        title={isChallengeOpen ? "Minimizar" : "Expandir"}
                                        aria-label={isChallengeOpen ? "Minimizar" : "Expandir"}
                                      >
                                        {isChallengeOpen ? (
                                          <ChevronDown className="text-white" />
                                        ) : (
                                          <ChevronUp className="text-white" />
                                        )}
                                      </Button>
                                      <span className="uppercase tracking-[0.18em] text-[11px]">Desafío</span>
                                    </div>

                                    <div>
                                      <span
                                        className={
                                          validationResult.status === "success"
                                            ? "rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700"
                                            : validationResult.status === "failure"
                                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-amber-700"
                                              : "rounded-full bg-slate-200 px-2 py-0.5 text-slate-700"
                                        }
                                      >
                                        {validationResult.status === "success"
                                          ? "Completado"
                                          : validationResult.status === "failure"
                                            ? "En progreso"
                                            : "Pendiente"}
                                      </span>
                                    </div>
                                  </div>

                                  {isChallengeOpen && challengeDefinition.description ? (
                                    <div className="px-3 pb-3 pt-2 text-sm text-slate-700">
                                      <p className="font-semibold text-slate-800">Instrucciones</p>
                                      <p className="mt-1 leading-snug">
                                        {challengeDefinition.description}
                                      </p>

                                      <div className="mt-3 flex justify-center">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="default"
                                          className="bg-blue-600 hover:bg-blue-700 text-white"
                                          disabled={isValidating}
                                          onClick={validateChallengeOutput}
                                        >
                                          {isValidating ? "Validando…" : "Validar"}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            <ConnectionErrorTooltip
                              open={connectionTooltip.tooltip.open}
                              message={connectionTooltip.tooltip.message}
                              x={connectionTooltip.tooltip.x}
                              y={connectionTooltip.tooltip.y}
                              onClose={connectionTooltip.hide}
                            />
                            <CreateSubflowOverlay
                              selectedNodes={selectedNodes}
                              edges={edges}
                              onCreateClick={openCreateSubflow}
                            />
                            <Background variant={BackgroundVariant.Dots} />
                            <Controls>
                              <ControlButton
                                onClick={() => setCanvasMode("pan")}
                                aria-pressed={canvasMode === "pan"}
                                title="Modo arrastrar (mover canvas)"
                                className="rf-mode-toggle"
                              >
                                <Hand className="rf-icon-hand" />
                              </ControlButton>
                              <ControlButton
                                onClick={() => setCanvasMode("select")}
                                aria-pressed={canvasMode === "select"}
                                title="Modo selección (cuadro)"
                                className="rf-mode-toggle"
                              >
                                <MousePointer2 />
                              </ControlButton>
                              <ControlButton
                                title="Mejorar formato"
                                onClick={onLayout}
                              >
                                <BrushCleaning className="fill-none!" />
                              </ControlButton>
                            </Controls>
                            <MiniMap />
                            <TopActionPanel
                              nodesCount={nodes.length}
                              isEngineRunning={isEngineRunning}
                              onRunClick={handleRunClick}
                              onStopClick={onStopClick}
                            />

                            <ConsolePanel
                              consoleOutputText={consoleOutputText}
                              activeRuntimePrompt={activeRuntimePrompt}
                              getRuntimePromptText={getRuntimePromptText}
                              runtimePromptInput={runtimePromptInput}
                              setRuntimePromptInput={setRuntimePromptInput}
                              onSubmitRuntimePrompt={onSubmitRuntimePrompt}
                              onCancelRuntimePrompt={onCancelRuntimePrompt}
                              onClearConsoleClick={onClearConsoleClick}
                              consoleScrollRef={consoleScrollRef}
                              consoleInputRef={consoleInputRef}
                              isOpen={isConsoleOpen}
                              onToggle={() => setIsConsoleOpen((prev) => !prev)}
                            />
                            {/* bottom expected-output card removed; expected output is shown in the banner */}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="application/json,.json"
                              className="hidden"
                              onChange={onProgramFileChange}
                            />
                          </ReactFlow>
                        </CanvasContextMenu>
                      </ConnectionHighlightProvider>
                    </SubflowTemplateContext.Provider>
                  </div>
                </div>

                <CreateSubflowDialog
                  open={isCreateSubflowOpen}
                  onOpenChange={onCreateSubflowDialogChange}
                  createSubflowError={createSubflowError}
                  pendingSubflowPorts={pendingSubflowPorts}
                  subflowName={subflowName}
                  onSubflowNameChange={(value) => {
                    setSubflowName(value);
                    setCreateSubflowNameError(null);
                  }}
                  createSubflowNameError={createSubflowNameError}
                  addSubflowToPalette={addSubflowToPalette}
                  onAddSubflowToPaletteChange={(checked) => {
                    setAddSubflowToPalette(checked);
                    setCreateSubflowNameError(null);
                  }}
                  canSave={
                    !!subflowName.trim() &&
                    !!pendingSubflowBounds &&
                    !!pendingSubflowPorts &&
                    !(addSubflowToPalette && !!createSubflowNameError)
                  }
                  onCancel={() => onCreateSubflowDialogChange(false)}
                  onSave={createSubflow}
                />
              </div>
            </SidebarInset>
          </div>
        </div>

        <DeleteSubflowDialog
          open={pendingDeleteTemplateId !== null}
          templateName={pendingDeleteTemplateName}
          onOpenChange={(open) => {
            if (!open) {
              setPendingDeleteTemplateId(null);
              setPendingDeleteTemplateName(null);
            }
          }}
          onCancel={() => {
            setPendingDeleteTemplateId(null);
            setPendingDeleteTemplateName(null);
          }}
          onConfirm={() => {
            if (pendingDeleteTemplateId) {
              deleteTemplate(pendingDeleteTemplateId);
            }
            setPendingDeleteTemplateId(null);
            setPendingDeleteTemplateName(null);
          }}
        />
      </SidebarProvider>
    </RemoteControllersProvider>
  );
}
