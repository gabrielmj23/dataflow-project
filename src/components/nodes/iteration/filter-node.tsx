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
} from "@xyflow/react";

import { Hand, MousePointer2, Funnel } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { nodeTypesCore } from "@/flow/node-types-core";
import {
  buildDroppedNodeData,
  editorPaletteLabelByType,
  projectClientToFlowPosition,
} from "@/flow/editor-node-factory";
import { useSharedEdgeConfig } from "@/hooks/useSharedEdgeConfig";
import { ListInputValueNode } from "@/components/nodes/iteration/list-input-value-node";
import { NestedSubflowNode } from "@/components/nodes/abstraction/nested-subflow-node";
import { SubflowOutputNode } from "@/components/nodes/abstraction/subflow-output-node";
import { useSubflowTemplateContext } from "@/flow/subflow-templates-context";
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

export type FilterNodeData = {
  label?: string;
  filterNodes?: Node[];
  filterEdges?: Edge[];
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

const FILTER_INPUT_NODE_ID = "filter-input-value";
const FILTER_OUTPUT_NODE_ID = "filter-output-value";

function ensureFilterBoundaryNodes(nodes: Node[]): Node[] {
  const list = Array.isArray(nodes) ? nodes : [];

  const inputNode =
    list.find((n) => String(n.id) === FILTER_INPUT_NODE_ID) ??
    list.find((n) => String(n.type) === "filterInputValue");

  const mandatoryInput: Node = inputNode
    ? {
        ...inputNode,
        id: FILTER_INPUT_NODE_ID,
        type: "filterInputValue",
      }
    : {
        id: FILTER_INPUT_NODE_ID,
        type: "filterInputValue",
        position: { x: 0, y: 0 },
        data: { label: "Valor de entrada" },
        selected: false,
      };

  const outputNode = list.find((n) => String(n.id) === FILTER_OUTPUT_NODE_ID);
  const mandatoryOutput: Node = outputNode
    ? {
        ...outputNode,
        id: FILTER_OUTPUT_NODE_ID,
        type: NODE_TYPES.FILTER_BOOLEAN_OUTPUT,
        data: {
          ...(typeof outputNode.data === "object" && outputNode.data
            ? outputNode.data
            : {}),
          label: "Valor de salida (verdadero/falso)",
          outputType: "boolean",
        },
      }
    : {
        id: FILTER_OUTPUT_NODE_ID,
        type: NODE_TYPES.FILTER_BOOLEAN_OUTPUT,
        position: { x: 260, y: 0 },
        data: {
          label: "Valor de salida (verdadero/falso)",
          outputType: "boolean",
        },
        selected: false,
      };

  const rest = list.filter(
    (n) =>
      String(n.id) !== FILTER_INPUT_NODE_ID &&
      String(n.id) !== FILTER_OUTPUT_NODE_ID,
  );

  return [mandatoryInput, mandatoryOutput, ...rest];
}

function filterEdgesByNodeIds(edges: Edge[], nodes: Node[]): Edge[] {
  const nodeIds = new Set(nodes.map((node) => String(node.id)));
  return edges.filter(
    (edge) =>
      nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target)),
  );
}

export const FilterNode = memo(({ id, data }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const templateContext = useSubflowTemplateContext();

  const {
    label = "Filtrar",
    filterNodes,
    filterEdges,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as FilterNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar ejecucion",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorCanvasMode, setEditorCanvasMode] = useState<"pan" | "select">(
    "pan",
  );
  const [draftNodes, setDraftNodes] = useState<Node[]>(() =>
    ensureFilterBoundaryNodes(filterNodes ?? []),
  );
  const [draftEdges, setDraftEdges] = useState<Edge[]>(() =>
    filterEdgesByNodeIds(
      filterEdges ?? [],
      ensureFilterBoundaryNodes(filterNodes ?? []),
    ),
  );

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
        change.id === FILTER_INPUT_NODE_ID,
    );
    const removingMandatoryOutput = changes.some(
      (change) =>
        change.type === "remove" &&
        "id" in change &&
        change.id === FILTER_OUTPUT_NODE_ID,
    );

    setDraftNodes((snapshot) => {
      const next = applyNodeChanges(changes, snapshot);
      if (removingMandatoryInput || removingMandatoryOutput) {
        return ensureFilterBoundaryNodes(next).map((node) =>
          String(node.id) === FILTER_INPUT_NODE_ID ||
          String(node.id) === FILTER_OUTPUT_NODE_ID
            ? { ...node, selected: false }
            : node,
        );
      }
      return next;
    });
  }, []);

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

  const editorFlowId = useMemo(() => `filter-editor-${id}`, [id]);

  const paletteLabelByType = editorPaletteLabelByType;

  const editorInstanceRef = useRef<ReactFlowInstance | null>(null);
  const nextInnerIdRef = useRef(1);

  const createInnerNodeId = useCallback(() => {
    const existing = new Set((draftNodes ?? []).map((n) => String(n.id)));
    let next = nextInnerIdRef.current++;
    let candidate = `inner-filter-${id}-${next}`;
    while (existing.has(candidate)) {
      next = nextInnerIdRef.current++;
      candidate = `inner-filter-${id}-${next}`;
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
      filterInputValue: ListInputValueNode,
      [NODE_TYPES.FILTER_BOOLEAN_OUTPUT]: SubflowOutputNode,
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
                String(n.id) !== FILTER_INPUT_NODE_ID &&
                String(n.id) !== FILTER_OUTPUT_NODE_ID,
            )
            .map((n) => n.id),
        );
        const nextNodes = ensureFilterBoundaryNodes(
          prev.filter(
            (n) =>
              !n.selected ||
              String(n.id) === FILTER_INPUT_NODE_ID ||
              String(n.id) === FILTER_OUTPUT_NODE_ID,
          ),
        );

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
  }, [isEditorOpen, setDraftNodes, setDraftEdges]);

  return (
    <>
      <IterationRectNodeShell
        nodeType="filter"
        icon={<Funnel className="h-5 w-5" />}
        label={label}
        subtitle={config.subtitle}
        variant="singleInSingleOut"
        onConnectClick={config.onConfigClick}
        onConfigClick={() => {
          const ensuredNodes = ensureFilterBoundaryNodes(filterNodes ?? []);

          setDraftNodes(ensuredNodes);
          setDraftEdges(filterEdgesByNodeIds(filterEdges ?? [], ensuredNodes));
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
            <DialogTitle>Editar filtro</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Define la condición de filtrado usando nodos.
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
                  const ensured = ensureFilterBoundaryNodes(draftNodes);
                  const normalizedEdges = filterEdgesByNodeIds(
                    draftEdges,
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
                          filterNodes: ensured,
                          filterEdges: normalizedEdges,
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

FilterNode.displayName = "FilterNode";
