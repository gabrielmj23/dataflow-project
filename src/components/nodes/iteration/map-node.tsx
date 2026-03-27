import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type {
  Edge,
  Node,
  NodeProps,
  OnConnectStartParams,
} from "@xyflow/react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
  useReactFlow,
  useUpdateNodeInternals,
} from "@xyflow/react";

import { Hand, Minus, MousePointer2, Plus, SquareFunction } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { nodeTypesCore } from "@/flow/node-types-core";
import {
  buildDroppedNodeData,
  editorPaletteLabelByType,
  projectClientToFlowPosition,
} from "@/flow/editor-node-factory";
import { useSharedEdgeConfig } from "@/hooks/useSharedEdgeConfig";
import { useSubcanvasNodeCreationLock } from "@/hooks/useSubcanvasNodeCreationLock";
import { MapInputValueNode } from "@/components/nodes/iteration/map-input-value-node";
import { useSubflowTemplateContext } from "@/flow/subflow-templates-context";
import { NestedSubflowNode } from "@/components/nodes/abstraction/nested-subflow-node";
import { ArrowConnectionLine } from "@/flow/arrow-connection-line";
import { validateConnection } from "@/flow/connection-validation";
import { ConnectionErrorTooltip } from "@/flow/connection-error-tooltip";
import { useConnectionValidationTooltip } from "@/flow/use-connection-validation-tooltip";
import { LabeledEdge } from "@/flow/labeled-edge";
import {
  ConnectionHighlightProvider,
  type ConnectionHighlightState,
} from "@/flow/connection-highlight-context";
import { getPortTypeMask } from "@/flow/port-data-type";
import { reconcileWriteGraph } from "@/utils/flow";
import { NODE_TYPES } from "@/common/constants";

export type MapNodeData = {
  label?: string;
  mapNodes?: Node[];
  mapEdges?: Edge[];
  contextInputCount?: number;
  contextInputLabels?: Record<string, string>;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

const MAP_INPUT_NODE_ID = "map-input-value";
const MAP_OUTPUT_NODE_ID = "map-output-value";

function sanitizeContextInputCount(value: unknown): number {
  const n = typeof value === "number" ? value : 0;
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function mapContextHandleId(index: number): string {
  return `in-${index + 1}`;
}

function mapContextNodeId(index: number): string {
  return `map-context-value-${index}`;
}

function isMapContextNodeId(nodeId: string): boolean {
  return /^map-context-value-\d+$/.test(nodeId);
}

function parseMapContextHandleIndex(handleId: unknown): number {
  const match = /^in-(\d+)$/.exec(String(handleId ?? ""));
  const idx = match ? Number(match[1]) : NaN;
  return Number.isFinite(idx) && idx >= 2 ? idx - 1 : 0;
}

function normalizeContextInputLabels(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};

  const entries = Object.entries(value as Record<string, unknown>);
  const next: Record<string, string> = {};

  for (const [key, raw] of entries) {
    const idx = parseMapContextHandleIndex(key);
    if (idx <= 0) continue;
    if (typeof raw !== "string") continue;
    next[mapContextHandleId(idx)] = raw;
  }

  return next;
}

function clampContextInputLabels(
  labels: unknown,
  contextInputCount: number,
): Record<string, string> {
  const safeCount = sanitizeContextInputCount(contextInputCount);
  const normalized = normalizeContextInputLabels(labels);

  return Object.fromEntries(
    Object.entries(normalized).filter(([handleId]) => {
      const idx = parseMapContextHandleIndex(handleId);
      return idx >= 1 && idx <= safeCount;
    }),
  );
}

function extractContextInputLabelsFromNodes(nodes: Node[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (let i = 1; ; i += 1) {
    const nodeId = mapContextNodeId(i);
    const node = nodes.find((n) => String(n.id) === nodeId);
    if (!node) break;

    const rawLabel =
      node.data && typeof node.data === "object"
        ? (node.data as { label?: unknown }).label
        : undefined;
    if (typeof rawLabel === "string") {
      result[mapContextHandleId(i)] = rawLabel;
    }
  }

  return result;
}

function ensureMapBoundaryNodes(params: {
  nodes: Node[];
  contextInputCount: number;
  contextInputLabels?: Record<string, string>;
}): Node[] {
  const { nodes, contextInputCount, contextInputLabels } = params;
  const list = Array.isArray(nodes) ? nodes : [];
  const safeContextCount = sanitizeContextInputCount(contextInputCount);
  const normalizedLabels = clampContextInputLabels(
    contextInputLabels,
    safeContextCount,
  );

  const inputNode =
    list.find((n) => String(n.id) === MAP_INPUT_NODE_ID) ??
    list.find((n) => String(n.type) === "mapInputValue");

  const mandatoryInput: Node = inputNode
    ? {
        ...inputNode,
        id: MAP_INPUT_NODE_ID,
        type: "mapInputValue",
      }
    : {
        id: MAP_INPUT_NODE_ID,
        type: NODE_TYPES.MAP_INPUT_VALUE,
        position: { x: 0, y: 0 },
        data: { label: "Valor de entrada" },
        selected: false,
      };

  const outputNode = list.find((n) => String(n.id) === MAP_OUTPUT_NODE_ID);
  const mandatoryOutput: Node = outputNode
    ? {
        ...outputNode,
        id: MAP_OUTPUT_NODE_ID,
        type: NODE_TYPES.SUBFLOW_OUTPUT,
      }
    : {
        id: MAP_OUTPUT_NODE_ID,
        type: NODE_TYPES.SUBFLOW_OUTPUT,
        position: { x: 260, y: 0 },
        data: { label: "Valor de salida" },
        selected: false,
      };

  const contextNodes: Node[] = Array.from({ length: safeContextCount }, (_, i) => {
    const contextIndex = i + 1;
    const contextNodeId = mapContextNodeId(contextIndex);
    const existing = list.find((n) => String(n.id) === contextNodeId);
    const handleId = mapContextHandleId(contextIndex);
    const savedLabel = normalizedLabels[handleId];
    const defaultLabel = `Valor ${contextIndex}`;
    const label =
      typeof savedLabel === "string" && savedLabel.trim().length > 0
        ? savedLabel
        : defaultLabel;

    const existingData =
      existing && existing.data && typeof existing.data === "object"
        ? (existing.data as Record<string, unknown>)
        : {};

    return {
      ...(existing ?? {
        id: contextNodeId,
        type: NODE_TYPES.SUBFLOW_INPUT,
        position: { x: 0, y: contextIndex * 120 },
        selected: false,
      }),
      id: contextNodeId,
      type: NODE_TYPES.SUBFLOW_INPUT,
      data: {
        ...existingData,
        label,
        iconVariant: "braces",
        contextSlot: contextIndex,
      },
      selected: false,
    };
  });

  const contextNodeIdSet = new Set(contextNodes.map((node) => String(node.id)));

  const rest = list.filter(
    (n) =>
      String(n.id) !== MAP_INPUT_NODE_ID &&
      String(n.id) !== MAP_OUTPUT_NODE_ID &&
      !isMapContextNodeId(String(n.id)) &&
      !contextNodeIdSet.has(String(n.id)),
  );

  return [mandatoryInput, ...contextNodes, mandatoryOutput, ...rest];
}

function filterEdgesByNodeIds(edges: Edge[], nodes: Node[]): Edge[] {
  const nodeIds = new Set(nodes.map((node) => String(node.id)));
  return edges.filter(
    (edge) =>
      nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target)),
  );
}

export const MapNode = memo(({ id, data }: NodeProps) => {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const templateContext = useSubflowTemplateContext();

  const {
    label = "Map",
    mapNodes,
    mapEdges,
    contextInputCount: rawContextInputCount,
    contextInputLabels: rawContextInputLabels,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as MapNodeData;

  const contextInputCount = useMemo(
    () => sanitizeContextInputCount(rawContextInputCount),
    [rawContextInputCount],
  );

  const contextInputLabels = useMemo(
    () => clampContextInputLabels(rawContextInputLabels, contextInputCount),
    [contextInputCount, rawContextInputLabels],
  );

  const targetHandleIds = useMemo(
    () => ["in", ...Array.from({ length: contextInputCount }, (_, i) => `in-${i + 2}`)],
    [contextInputCount],
  );

  const targetHandleLabels = useMemo(
    () =>
      targetHandleIds.map((handleId) => {
        if (handleId === "in") return "Lista";
        const ctxIndex = parseMapContextHandleIndex(handleId);
        if (ctxIndex <= 0) return null;
        const saved = contextInputLabels[handleId];
        if (typeof saved === "string" && saved.trim().length > 0) return saved;
        return `Valor ${ctxIndex}`;
      }),
    [contextInputLabels, targetHandleIds],
  );

  const targetHandlePlaceholders = useMemo(
    () =>
      targetHandleIds.map((handleId) => {
        if (handleId === "in") return "Lista";
        const ctxIndex = parseMapContextHandleIndex(handleId);
        return ctxIndex > 0 ? `Valor ${ctxIndex}` : "";
      }),
    [targetHandleIds],
  );

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar ejecucion",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  useSubcanvasNodeCreationLock(isEditorOpen);
  const [editorCanvasMode, setEditorCanvasMode] = useState<"pan" | "select">(
    "pan",
  );
  const [draftNodes, setDraftNodes] = useState<Node[]>(() =>
    ensureMapBoundaryNodes({
      nodes: mapNodes ?? [],
      contextInputCount,
      contextInputLabels,
    }),
  );
  const [draftEdges, setDraftEdges] = useState<Edge[]>(() =>
    filterEdgesByNodeIds(
      mapEdges ?? [],
      ensureMapBoundaryNodes({
        nodes: mapNodes ?? [],
        contextInputCount,
        contextInputLabels,
      }),
    ),
  );

  useEffect(() => {
    updateNodeInternals(id);
  }, [contextInputCount, id, updateNodeInternals]);

  useEffect(() => {
    if (!isEditorOpen) return;

    const nextLabels = extractContextInputLabelsFromNodes(draftNodes);
    setNodes((prev) =>
      prev.map((n) => {
        if (String(n.id) !== String(id)) return n;
        const currentData =
          n.data && typeof n.data === "object"
            ? (n.data as Record<string, unknown>)
            : {};

        return {
          ...n,
          data: {
            ...currentData,
            contextInputLabels: nextLabels,
          },
        };
      }),
    );
  }, [draftNodes, id, isEditorOpen, setNodes]);

  // Keep Write nodes' input handles + variable list in sync with connections
  // inside the embedded editor (same behavior as the main canvas).
  useEffect(() => {
    const result = reconcileWriteGraph(draftNodes, draftEdges);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (result.changedEdges) setDraftEdges(result.edges);
    if (result.changedNodes) setDraftNodes(result.nodes);
  }, [draftEdges, draftNodes]);

  const connectionTooltip = useConnectionValidationTooltip(draftNodes);
  const [connectionHighlight, setConnectionHighlight] =
    useState<ConnectionHighlightState>(null);

  const onEditorNodesChange = useCallback((changes: NodeChange[]) => {
    const removingMandatoryInput = changes.some(
      (change) =>
        change.type === "remove" &&
        "id" in change &&
        change.id === MAP_INPUT_NODE_ID,
    );
    const removingMandatoryOutput = changes.some(
      (change) =>
        change.type === "remove" &&
        "id" in change &&
        change.id === MAP_OUTPUT_NODE_ID,
    );

    setDraftNodes((snapshot) => {
      const next = applyNodeChanges(changes, snapshot);
      if (removingMandatoryInput || removingMandatoryOutput) {
        return ensureMapBoundaryNodes({
          nodes: next,
          contextInputCount,
          contextInputLabels,
        }).map((node) =>
          String(node.id) === MAP_INPUT_NODE_ID ||
          String(node.id) === MAP_OUTPUT_NODE_ID
            ? { ...node, selected: false }
            : node,
        );
      }
      return next;
    });
  }, [contextInputCount, contextInputLabels]);

  const onEditorEdgesChange = useCallback((changes: EdgeChange[]) => {
    setDraftEdges((snapshot) => applyEdgeChanges(changes, snapshot));
  }, []);

  const onEditorConnect = useCallback(
    (connection: Connection) => {
      const validation = validateConnection(draftNodes, connection);
      if (!validation.ok) {
        connectionTooltip.show(validation.message ?? "Conexión no válida.");
        return;
      }

      setDraftEdges((snapshot) => addEdge(connection, snapshot));
    },
    [connectionTooltip, draftNodes],
  );
  const sharedEdgeConfig = useSharedEdgeConfig<Edge>(setDraftEdges);

  const onEditorConnectStart = useCallback(
    (event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      connectionTooltip.onConnectStart(event, params);

      if (!params.nodeId || params.handleType !== "source") {
        setConnectionHighlight(null);
        return;
      }

      const sourceNode = draftNodes.find(
        (n) => String(n.id) === String(params.nodeId),
      );
      const nodeType =
        sourceNode && typeof sourceNode.type === "string"
          ? sourceNode.type
          : null;
      const sourceMask = getPortTypeMask({
        nodeType,
        handleType: "source",
        handleId: params.handleId ?? null,
      });
      setConnectionHighlight({ sourceMask });
    },
    [connectionTooltip, draftNodes],
  );

  const onEditorConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      connectionTooltip.onConnectEnd(event);
      setConnectionHighlight(null);
    },
    [connectionTooltip],
  );

  const editorFlowId = useMemo(() => `map-editor-${id}`, [id]);

  const paletteLabelByType = editorPaletteLabelByType;

  const editorInstanceRef = useRef<ReactFlowInstance | null>(null);
  const nextInnerIdRef = useRef(1);

  const createInnerNodeId = useCallback(() => {
    const existing = new Set((draftNodes ?? []).map((n) => String(n.id)));
    let next = nextInnerIdRef.current++;
    let candidate = `inner-map-${id}-${next}`;
    while (existing.has(candidate)) {
      next = nextInnerIdRef.current++;
      candidate = `inner-map-${id}-${next}`;
    }
    return candidate;
  }, [draftNodes, id]);

  const onEditorDragOver = useCallback((event: DragEvent) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onEditorDrop = useCallback(
    (event: DragEvent) => {
      event.stopPropagation();
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) {
        return;
      }

      const templateIdRaw = event.dataTransfer.getData(
        "application/subflow-template-id",
      );
      const templateId = templateIdRaw || null;

      const position = projectClientToFlowPosition(
        editorInstanceRef.current,
        event.clientX,
        event.clientY,
      );

      const data = buildDroppedNodeData({
        type,
        templateId,
        paletteLabelByType,
        resolveSubflowTemplate: templateContext?.resolveTemplate,
        includeTemplateAuthorName: false,
      });

      const newNode: Node = {
        id: createInnerNodeId(),
        type,
        position,
        data,
      };

      setDraftNodes((prev) => [...prev, newNode]);
    },
    [createInnerNodeId, paletteLabelByType, templateContext],
  );

  const editorNodeTypes = useMemo(
    () => ({
      ...nodeTypesCore,
      subflow: NestedSubflowNode,
      mapInputValue: MapInputValueNode,
    }),
    [],
  );

  // Delete selected nodes/edges with Backspace/Delete when editor is open
  useEffect(() => {
    if (!isEditorOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Prevent the main canvas key handler (in App.tsx) from also deleting
      // whatever is selected there while we're interacting with this modal.
      e.preventDefault();
      e.stopImmediatePropagation();

      setDraftNodes((prev) => {
        const removedIds = new Set(
          prev
            .filter(
              (n) =>
                n.selected &&
                String(n.id) !== MAP_INPUT_NODE_ID &&
                String(n.id) !== MAP_OUTPUT_NODE_ID,
            )
            .map((n) => n.id),
        );
        const nextNodes = ensureMapBoundaryNodes({
          nodes: prev.filter(
            (n) =>
              !n.selected ||
              String(n.id) === MAP_INPUT_NODE_ID ||
              String(n.id) === MAP_OUTPUT_NODE_ID,
          ),
          contextInputCount,
          contextInputLabels,
        });

        setDraftEdges((prevEdges) =>
          prevEdges.filter((edge) => {
            if ((edge as Edge).selected) return false;
            const src = String((edge as Edge).source);
            const tgt = String((edge as Edge).target);
            if (removedIds.has(src) || removedIds.has(tgt)) return false;
            return true;
          }),
        );

        return nextNodes;
      });
    };

    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [
    contextInputCount,
    contextInputLabels,
    isEditorOpen,
    setDraftNodes,
    setDraftEdges,
  ]);

  const handleAddContextInput = useCallback(() => {
    setNodes((prev) =>
      prev.map((node) => {
        if (String(node.id) !== String(id)) return node;
        const currentData =
          node.data && typeof node.data === "object"
            ? (node.data as Record<string, unknown>)
            : {};

        const currentCount = sanitizeContextInputCount(
          currentData.contextInputCount,
        );

        return {
          ...node,
          data: {
            ...currentData,
            contextInputCount: currentCount + 1,
          },
        };
      }),
    );
  }, [id, setNodes]);

  const handleRemoveContextInput = useCallback(() => {
    if (contextInputCount <= 0) return;

    const handleIdToRemove = mapContextHandleId(contextInputCount);
    const nodeIdToRemove = mapContextNodeId(contextInputCount);

    setEdges((prev) =>
      prev.filter(
        (edge) =>
          !(
            String(edge.target ?? "") === String(id) &&
            String(edge.targetHandle ?? "") === handleIdToRemove
          ),
      ),
    );

    setNodes((prev) =>
      prev.map((node) => {
        if (String(node.id) !== String(id)) return node;
        const currentData =
          node.data && typeof node.data === "object"
            ? (node.data as Record<string, unknown>)
            : {};

        const nextCount = Math.max(
          0,
          sanitizeContextInputCount(currentData.contextInputCount) - 1,
        );
        const nextLabels = clampContextInputLabels(
          currentData.contextInputLabels,
          nextCount,
        );

        return {
          ...node,
          data: {
            ...currentData,
            contextInputCount: nextCount,
            contextInputLabels: nextLabels,
          },
        };
      }),
    );

    setDraftNodes((prev) =>
      prev.filter((node) => String(node.id) !== nodeIdToRemove),
    );
    setDraftEdges((prev) =>
      prev.filter(
        (edge) =>
          String(edge.source ?? "") !== nodeIdToRemove &&
          String(edge.target ?? "") !== nodeIdToRemove,
      ),
    );
  }, [contextInputCount, id, setEdges, setNodes]);

  return (
    <>
      <IterationRectNodeShell
        nodeType="map"
        icon={<SquareFunction className="h-6 w-6" />}
        label={label}
        subtitle={config.subtitle}
        variant="dynamicInSingleOut"
        targetHandleIds={targetHandleIds}
        targetHandleLabels={targetHandleLabels}
        targetHandlePlaceholders={targetHandlePlaceholders}
        onTargetHandleLabelChange={({ handleId, label: nextLabel }) => {
          if (handleId === "in") return;
          const contextIndex = parseMapContextHandleIndex(handleId);
          if (contextIndex <= 0) return;

          const trimmed = String(nextLabel ?? "").trim();

          setNodes((prev) =>
            prev.map((node) => {
              if (String(node.id) !== String(id)) return node;
              const currentData =
                node.data && typeof node.data === "object"
                  ? (node.data as Record<string, unknown>)
                  : {};
              const labels = clampContextInputLabels(
                currentData.contextInputLabels,
                contextInputCount,
              );
              labels[handleId] = trimmed;

              return {
                ...node,
                data: {
                  ...currentData,
                  contextInputLabels: labels,
                },
              };
            }),
          );

          const contextNodeId = mapContextNodeId(contextIndex);
          setDraftNodes((prev) =>
            prev.map((node) => {
              if (String(node.id) !== contextNodeId) return node;
              const currentData =
                node.data && typeof node.data === "object"
                  ? (node.data as Record<string, unknown>)
                  : {};
              return {
                ...node,
                data: {
                  ...currentData,
                  label: trimmed,
                },
              };
            }),
          );
        }}
        sideActionsClassName="top-auto -bottom-8 left-1/2 -translate-x-1/2 translate-y-0 flex flex-row items-center justify-center gap-2 w-auto h-auto bg-transparent backdrop-blur-none border-0 rounded-none shadow-none z-0"
        sideActions={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="node"
                  aria-label="Agregar valor"
                  className="pointer-events-auto rounded-sm bg-transparent p-0 text-(--node-action-color) transition-colors flex h-5 w-5 items-center justify-center"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleAddContextInput();
                  }}
                >
                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Agregar valor de contexto
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="node"
                  aria-label="Eliminar valor"
                  className="pointer-events-auto rounded-sm bg-transparent p-0 text-(--node-action-color) disabled:opacity-30 transition-colors flex h-5 w-5 items-center justify-center"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveContextInput();
                  }}
                  disabled={contextInputCount <= 0}
                >
                  <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                Eliminar valor de contexto
              </TooltipContent>
            </Tooltip>
          </>
        }
        onConnectClick={config.onConfigClick}
        onConfigClick={() => {
          const ensuredNodes = ensureMapBoundaryNodes({
            nodes: mapNodes ?? [],
            contextInputCount,
            contextInputLabels,
          });

          setDraftNodes(ensuredNodes);
          setDraftEdges(filterEdgesByNodeIds(mapEdges ?? [], ensuredNodes));
          setIsEditorOpen(true);
        }}
      />
      {config.dialog}

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen} modal={false}>
        <DialogContent
          className="sm:max-w-4xl"
          onPointerDownOutside={(event) => {
            event.preventDefault();
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Editar map</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Define la función de mapeo usando nodos.
            </p>

            <div className="h-[60vh] w-full overflow-hidden rounded-md border">
              <ReactFlowProvider>
                <ConnectionHighlightProvider value={connectionHighlight}>
                  <ReactFlow
                    id={editorFlowId}
                    nodes={draftNodes}
                    edges={draftEdges}
                    nodeTypes={editorNodeTypes}
                    {...sharedEdgeConfig}
                    connectionLineComponent={ArrowConnectionLine}
                    onNodesChange={onEditorNodesChange}
                    onEdgesChange={onEditorEdgesChange}
                    onConnect={onEditorConnect}
                    edgeTypes={{ default: LabeledEdge }}
                    isValidConnection={connectionTooltip.isValidConnection}
                    onConnectStart={onEditorConnectStart}
                    onConnectEnd={onEditorConnectEnd}
                    panOnDrag={editorCanvasMode === "pan"}
                    selectionOnDrag={editorCanvasMode === "select"}
                    selectionMode={SelectionMode.Partial}
                    className={
                      editorCanvasMode === "pan"
                        ? "rf-mode-pan"
                        : "rf-mode-select"
                    }
                    onInit={(instance) => {
                      editorInstanceRef.current = instance;
                    }}
                    onDrop={onEditorDrop}
                    onDragOver={onEditorDragOver}
                    fitView
                    proOptions={{ hideAttribution: true }}
                  >
                    <ConnectionErrorTooltip
                      open={connectionTooltip.tooltip.open}
                      message={connectionTooltip.tooltip.message}
                      x={connectionTooltip.tooltip.x}
                      y={connectionTooltip.tooltip.y}
                      onClose={connectionTooltip.hide}
                    />
                    <Background variant={BackgroundVariant.Dots} />
                    <Controls>
                      <ControlButton
                        className="rf-mode-toggle"
                        aria-pressed={editorCanvasMode === "pan"}
                        title="Modo arrastrar"
                        onClick={() => setEditorCanvasMode("pan")}
                      >
                        <Hand className="rf-icon-hand" size={22} />
                      </ControlButton>
                      <ControlButton
                        className="rf-mode-toggle"
                        aria-pressed={editorCanvasMode === "select"}
                        title="Modo selección"
                        onClick={() => setEditorCanvasMode("select")}
                      >
                        <MousePointer2 size={22} />
                      </ControlButton>
                    </Controls>
                  </ReactFlow>
                </ConnectionHighlightProvider>
              </ReactFlowProvider>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsEditorOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const ensured = ensureMapBoundaryNodes({
                    nodes: draftNodes,
                    contextInputCount,
                    contextInputLabels: extractContextInputLabelsFromNodes(
                      draftNodes,
                    ),
                  });
                  const normalizedEdges = filterEdgesByNodeIds(
                    draftEdges,
                    ensured,
                  );
                  const nextContextLabels = extractContextInputLabelsFromNodes(
                    ensured,
                  );

                  setNodes((prev) =>
                    prev.map((n) => {
                      if (n.id !== id) {
                        return n;
                      }

                      return {
                        ...n,
                        data: {
                          ...(n.data as object),
                          label,
                          contextInputCount,
                          contextInputLabels: nextContextLabels,
                          mapNodes: ensured,
                          mapEdges: normalizedEdges,
                        },
                      };
                    }),
                  );

                  setIsEditorOpen(false);
                }}
              >
                Guardar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

MapNode.displayName = "MapNode";
