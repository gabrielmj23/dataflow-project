import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Edge, Node, NodeProps, OnConnectStartParams } from "@xyflow/react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
  useReactFlow,
} from "@xyflow/react";

import { Hand, MousePointer2 } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { nodePalette } from "@/flow/node-palette";
import { nodeTypesCore } from "@/flow/node-types-core";
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

function parseWriteTargetHandleIndex(handle: unknown): number {
  const m = /^in-(\d+)$/.exec(String(handle ?? ""));
  const idx = m ? parseInt(m[1] ?? "", 10) : NaN;
  return Number.isFinite(idx) ? idx : 0;
}

function clampWriteTemplateToMaxVar(
  template: unknown,
  maxVar: number
): string | undefined {
  if (typeof template !== "string") return undefined;
  if (!Number.isFinite(maxVar) || maxVar < 1) {
    return template.replace(/\{\d+\}/g, "");
  }

  return template.replace(/\{(\d+)\}/g, (full, raw) => {
    const idx = parseInt(String(raw), 10);
    if (!Number.isFinite(idx)) return "";
    return idx >= 1 && idx <= maxVar ? full : "";
  });
}

function reconcileWriteGraph(
  nodes: Node[],
  edges: Edge[]
): {
  nodes: Node[];
  edges: Edge[];
  changedNodes: boolean;
  changedEdges: boolean;
} {
  const writeMaps = new Map<
    string,
    {
      map: Map<number, number>;
      desiredInputCount: number;
      maxVarAllowed: number;
    }
  >();

  for (const n of nodes) {
    if (n.type !== "write") continue;
    const nodeId = String(n.id);

    const uniqueConnected = new Set<number>();
    for (const e of edges) {
      if (String(e.target) !== nodeId) continue;
      const idx = parseWriteTargetHandleIndex(e.targetHandle);
      if (idx > 0) uniqueConnected.add(idx);
    }

    const sorted = Array.from(uniqueConnected).sort((a, b) => a - b);
    const map = new Map<number, number>();
    for (let i = 0; i < sorted.length; i++) {
      const oldIdx = sorted[i];
      if (!oldIdx) continue;
      map.set(oldIdx, i + 1);
    }

    const desiredInputCount = sorted.length === 0 ? 1 : sorted.length + 1;
    const maxVarAllowed = desiredInputCount - 1;
    writeMaps.set(nodeId, { map, desiredInputCount, maxVarAllowed });
  }

  let changedEdges = false;
  const nextEdges = edges.map((e) => {
    const targetId = String(e.target);
    const info = writeMaps.get(targetId);
    if (!info) return e;

    const oldIdx = parseWriteTargetHandleIndex(e.targetHandle);
    if (oldIdx <= 0) return e;

    const newIdx = info.map.get(oldIdx);
    if (!newIdx || newIdx === oldIdx) return e;

    changedEdges = true;
    return {
      ...e,
      targetHandle: `in-${newIdx}`,
    } as Edge;
  });

  let changedNodes = false;
  const nextNodes = nodes.map((n) => {
    if (n.type !== "write") return n;
    const nodeId = String(n.id);
    const info = writeMaps.get(nodeId);
    if (!info) return n;

    const data =
      n.data && typeof n.data === "object"
        ? (n.data as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const currentRaw =
      typeof data.inputCount === "number" ? data.inputCount : 1;
    const current = Number.isFinite(currentRaw)
      ? Math.max(1, Math.floor(currentRaw))
      : 1;

    const template = data.template;
    const remappedTemplate =
      typeof template !== "string"
        ? undefined
        : template.replace(/\{(\d+)\}/g, (_full, raw) => {
            const oldIdx = parseInt(String(raw), 10);
            if (!Number.isFinite(oldIdx)) return "";
            const newIdx = info.map.get(oldIdx);
            if (!newIdx) return "";
            return newIdx >= 1 && newIdx <= info.maxVarAllowed
              ? `{${newIdx}}`
              : "";
          });

    const clampedTemplate = clampWriteTemplateToMaxVar(
      remappedTemplate ?? template,
      info.maxVarAllowed
    );

    const needsInputCountUpdate = current !== info.desiredInputCount;
    const needsTemplateUpdate =
      typeof template === "string" && typeof clampedTemplate === "string"
        ? template !== clampedTemplate
        : false;

    if (!needsInputCountUpdate && !needsTemplateUpdate) return n;

    changedNodes = true;
    return {
      ...n,
      data: {
        ...data,
        ...(needsInputCountUpdate
          ? { inputCount: info.desiredInputCount }
          : null),
        ...(needsTemplateUpdate ? { template: clampedTemplate } : null),
      },
    } as Node;
  });

  return {
    nodes: changedNodes ? nextNodes : nodes,
    edges: changedEdges ? nextEdges : edges,
    changedNodes,
    changedEdges,
  };
}

export type MapNodeData = {
  label?: string;
  mapNodes?: Node[];
  mapEdges?: Edge[];
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

const MAP_INPUT_NODE_ID = "map-input-value";

export const MapNode = memo(({ id, data }: NodeProps) => {
  const { setNodes } = useReactFlow();
  const templateContext = useSubflowTemplateContext();

  const {
    label = "Map",
    mapNodes,
    mapEdges,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as MapNodeData;

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
    "pan"
  );
  const [draftNodes, setDraftNodes] = useState<Node[]>(() => mapNodes ?? []);
  const [draftEdges, setDraftEdges] = useState<Edge[]>(() => mapEdges ?? []);

  // Keep Write nodes' input handles + variable list in sync with connections
  // inside the embedded editor (same behavior as the main canvas).
  useEffect(() => {
    const result = reconcileWriteGraph(draftNodes, draftEdges);
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
        change.id === MAP_INPUT_NODE_ID
    );

    setDraftNodes((snapshot) => {
      const next = applyNodeChanges(changes, snapshot);
      if (removingMandatoryInput) {
        return next.some((n) => n.id === MAP_INPUT_NODE_ID)
          ? next
          : [
              {
                id: MAP_INPUT_NODE_ID,
                type: "mapInputValue",
                position: { x: 0, y: 0 },
                data: { label: "Valor de entrada" },
                selected: false,
              } satisfies Node,
              ...next,
            ];
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
    [connectionTooltip, draftNodes]
  );

  const onEditorConnectStart = useCallback(
    (event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      connectionTooltip.onConnectStart(event, params);

      if (!params.nodeId || params.handleType !== "source") {
        setConnectionHighlight(null);
        return;
      }

      const sourceNode = draftNodes.find(
        (n) => String(n.id) === String(params.nodeId)
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
    [connectionTooltip, draftNodes]
  );

  const onEditorConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      connectionTooltip.onConnectEnd(event);
      setConnectionHighlight(null);
    },
    [connectionTooltip]
  );

  const editorFlowId = useMemo(() => `map-editor-${id}`, [id]);

  const paletteLabelByType = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of nodePalette) {
      for (const item of category.items) {
        map.set(item.type, item.label);
      }
    }
    return map;
  }, []);

  const editorInstanceRef = useRef<ReactFlowInstance | null>(null);
  const nextInnerIdRef = useRef(1);

  const createInnerNodeId = useCallback(() => {
    const next = nextInnerIdRef.current++;
    return `inner-map-${id}-${next}`;
  }, [id]);

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
        "application/subflow-template-id"
      );
      const templateId = templateIdRaw || null;

      const instance = editorInstanceRef.current as
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

      const screenPos = { x: event.clientX, y: event.clientY };
      const position = instance?.screenToFlowPosition?.(screenPos) ??
        instance?.project?.(screenPos) ?? { x: 0, y: 0 };

      const nodeLabel = paletteLabelByType.get(type);

      let data: Record<string, unknown> = {};

      if (type === "subflow" && templateId && templateContext) {
        const resolved = templateContext.resolveTemplate(templateId);
        if (resolved) {
          data = {
            label: resolved.name,
            inCount: resolved.inCount,
            outCount: resolved.outCount,
            subflowNodes: resolved.nodes,
            subflowEdges: resolved.edges,
            templateId: resolved.id,
          };
        } else if (nodeLabel) {
          data = { label: nodeLabel };
        }
      } else if (nodeLabel) {
        data = { label: nodeLabel };
      }

      const newNode: Node = {
        id: createInnerNodeId(),
        type,
        position,
        data,
      };

      setDraftNodes((prev) => [...prev, newNode]);
    },
    [createInnerNodeId, paletteLabelByType, templateContext]
  );

  const editorNodeTypes = useMemo(
    () => ({
      ...nodeTypesCore,
      subflow: NestedSubflowNode,
      mapInputValue: MapInputValueNode,
    }),
    []
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
          prev.filter((n) => n.selected).map((n) => n.id)
        );
        const nextNodes = prev.filter((n) => !n.selected);

        setDraftEdges((prevEdges) =>
          prevEdges.filter((edge) => {
            if ((edge as Edge).selected) return false;
            const src = String((edge as Edge).source);
            const tgt = String((edge as Edge).target);
            if (removedIds.has(src) || removedIds.has(tgt)) return false;
            return true;
          })
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
        nodeType="map"
        icon={<span className="text-sm font-bold">↦</span>}
        label={label}
        subtitle={config.subtitle}
        variant="singleInSingleOut"
        onConnectClick={config.onConfigClick}
        onConfigClick={() => {
          const baseNodes = mapNodes ?? [];
          const hasInput = baseNodes.some((n) => n.id === MAP_INPUT_NODE_ID);
          const ensuredNodes = hasInput
            ? baseNodes.map((n) =>
                n.id === MAP_INPUT_NODE_ID ? { ...n, type: "mapInputValue" } : n
              )
            : [
                {
                  id: MAP_INPUT_NODE_ID,
                  type: "mapInputValue",
                  position: { x: 0, y: 0 },
                  data: { label: "Valor de entrada" },
                  selected: false,
                } satisfies Node,
                ...baseNodes,
              ];

          setDraftNodes(ensuredNodes);
          setDraftEdges(mapEdges ?? []);
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
                  defaultEdgeOptions={{
                    markerEnd: {
                      type: MarkerType.ArrowClosed,
                      width: 14,
                      height: 14,
                    },
                  }}
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
                  const ensured = draftNodes.some(
                    (n) => n.id === MAP_INPUT_NODE_ID
                  )
                    ? draftNodes
                    : [
                        {
                          id: MAP_INPUT_NODE_ID,
                          type: "mapInputValue",
                          position: { x: 0, y: 0 },
                          data: { label: "Valor de entrada" },
                          selected: false,
                        } satisfies Node,
                        ...draftNodes,
                      ];

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
                          mapNodes: ensured,
                          mapEdges: draftEdges,
                        },
                      };
                    })
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
