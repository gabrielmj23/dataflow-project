import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Edge, Node, NodeProps } from "@xyflow/react";
import {
  addEdge,
  applyEdgeChanges,
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
  useStore,
  Position,
} from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { Copy, Hand, MousePointer2, Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { nodePalette } from "@/flow/node-palette";
import { nodeTypesCore } from "@/flow/node-types-core";
import { computeOpenPortsFromLookup } from "@/flow/subflow-utils";
import { NestedSubflowNode } from "@/components/nodes/abstraction/nested-subflow-node";
import { ArrowConnectionLine } from "@/flow/arrow-connection-line";
import { validateConnection } from "@/flow/connection-validation";
import { ConnectionErrorTooltip } from "@/flow/connection-error-tooltip";
import { useConnectionValidationTooltip } from "@/flow/use-connection-validation-tooltip";
import { reconcileWriteGraph } from "@/utils/flow";
import {
  createConditionalPair,
  filterLockedEdgeChanges,
  handlePairedNodeChanges,
} from "@/utils/conditional-pair";

export type ReplicateFlowNodeData = {
  label?: string;
  inCount?: number;
  outCount?: number;
  subflowNodes?: Node[];
  subflowEdges?: Edge[];
  isSelfCall?: boolean;
};

type ReplicateFlowRfNode = Node<ReplicateFlowNodeData>;

function EditorStoreBridge({
  onNodeLookup,
}: {
  onNodeLookup: (lookup: unknown) => void;
}) {
  const nodeLookup = useStore((state) => state.nodeLookup);

  useEffect(() => {
    onNodeLookup(nodeLookup);
  }, [nodeLookup, onNodeLookup]);

  return null;
}

function offsets(count: number): string[] {
  const safeCount = Math.max(0, Math.floor(count));
  if (safeCount === 0) {
    return [];
  }
  if (safeCount === 1) {
    return ["50%"];
  }

  const start = 15;
  const end = 85;
  const step = (end - start) / (safeCount - 1);
  return Array.from({ length: safeCount }, (_, i) => `${start + step * i}%`);
}

export const ReplicateFlowNode = memo(
  ({ id, data }: NodeProps<ReplicateFlowRfNode>) => {
    const { setNodes } = useReactFlow();

    const {
      label = "Replicar flujo",
      inCount: rawInCount,
      outCount: rawOutCount,
      subflowNodes,
      subflowEdges,
      isSelfCall = false,
    } = (data ?? {}) as ReplicateFlowNodeData;

    const inCount = Number.isFinite(rawInCount) ? (rawInCount as number) : 0;
    const outCount = Number.isFinite(rawOutCount) ? (rawOutCount as number) : 0;

    const inOffsets = offsets(inCount);
    const outOffsets = offsets(outCount);

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorCanvasMode, setEditorCanvasMode] = useState<"pan" | "select">(
      "pan",
    );
    const [draftNodes, setDraftNodes] = useState<Node[]>(
      () => subflowNodes ?? [],
    );
    const [draftEdges, setDraftEdges] = useState<Edge[]>(
      () => subflowEdges ?? [],
    );
    const [draftLabel, setDraftLabel] = useState(label);
    const [nameError, setNameError] = useState<string | null>(null);

    const connectionTooltip = useConnectionValidationTooltip(draftNodes);

    // Keep Write nodes inside the subflow editor in sync with their connections
    useEffect(() => {
      const result = reconcileWriteGraph(draftNodes, draftEdges);
      if (!result.changedEdges && !result.changedNodes) return;
      const timer = window.setTimeout(() => {
        if (result.changedEdges) setDraftEdges(result.edges as Edge[]);
        if (result.changedNodes) setDraftNodes(result.nodes as Node[]);
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }, [draftEdges, draftNodes, setDraftEdges, setDraftNodes]);

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

        // Prevent the parent canvas key handler from also deleting
        // whatever is selected there while we're interacting with this modal.
        e.preventDefault();
        e.stopImmediatePropagation();

        setDraftNodes((prev) => {
          const removedIds = new Set(
            prev.filter((n) => n.selected).map((n) => n.id),
          );
          const nextNodes = prev.filter((n) => !n.selected);

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

    const editorLookupRef = useRef<unknown>(null);

    const onEditorNodesChange = useCallback(
      (changes: NodeChange[]) => {
        setDraftNodes((snapshot) => {
          const { nextNodes, nextEdges } = handlePairedNodeChanges({
            changes,
            nodes: snapshot,
            edges: draftEdges,
          });
          setDraftEdges(nextEdges);
          return nextNodes;
        });
      },
      [draftEdges, setDraftEdges, setDraftNodes],
    );

    const onEditorEdgesChange = useCallback(
      (changes: EdgeChange[]) => {
        setDraftEdges((snapshot) => {
          const filteredChanges = filterLockedEdgeChanges(changes, snapshot);
          return applyEdgeChanges(filteredChanges, snapshot);
        });
      },
      [setDraftEdges],
    );

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

    const editorFlowId = useMemo(() => `nested-subflow-editor-${id}`, [id]);

    const paletteLabelByType = useMemo(() => {
      const map = new Map<string, string>();
      for (const category of nodePalette) {
        for (const item of category.items) {
          map.set(item.type, item.label);
        }
      }
      return map;
    }, []);

    type EditorFlowNode = Node & { type: string | undefined };
    const editorInstanceRef = useRef<ReactFlowInstance<
      EditorFlowNode,
      Edge
    > | null>(null);
    const nextInnerIdRef = useRef(1);
    const createInnerNodeId = useCallback(() => {
      const existing = new Set<string>([
        ...(draftNodes ?? []).map((n) => String(n.id)),
        ...(draftEdges ?? []).map((e) => String(e.id)),
      ]);
      let next = nextInnerIdRef.current++;
      let candidate = `inner-replicate-flow-${id}-${next}`;
      while (existing.has(candidate)) {
        next = nextInnerIdRef.current++;
        candidate = `inner-replicate-flow-${id}-${next}`;
      }
      return candidate;
    }, [draftNodes, draftEdges, id]);

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

        const instance = editorInstanceRef.current as
          | (ReactFlowInstance<EditorFlowNode, Edge> & {
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

        if (type === "conditionalPair") {
          const { nodes: pairNodes, edge: pairEdge } = createConditionalPair({
            position,
            createId: createInnerNodeId,
          });

          setDraftNodes((prev) => [...prev, ...pairNodes]);
          setDraftEdges((prev) => [...prev, pairEdge]);
          return;
        }

        const newNode: Node = {
          id: createInnerNodeId(),
          type,
          position,
          data: nodeLabel ? { label: nodeLabel } : {},
        };

        setDraftNodes((prev) => [...prev, newNode]);
      },
      [createInnerNodeId, paletteLabelByType, setDraftNodes, setDraftEdges],
    );

    return (
      <BaseNode
        className="relative flex w-36 flex-col items-center justify-center rounded-xl border-yellow-600 bg-yellow-500 px-3 py-2 text-center text-white shadow-md"
        onConfigClick={
          !isSelfCall
            ? () => {
                setDraftNodes(subflowNodes ?? []);
                setDraftEdges(subflowEdges ?? []);
                setDraftLabel(label);
                setIsEditorOpen(true);
              }
            : undefined
        }
      >
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-xl font-bold leading-none">
            <Copy className="rotate-90" />
          </div>
          <div className="text-sm leading-tight">{label}</div>
        </div>

        {inOffsets.map((offset, index) => (
          <CustomTypedHandle
            key={`l-${offset}`}
            type="target"
            position={Position.Left}
            style={{ top: offset }}
            id={`in-${index + 1}`}
            dataType="any"
            className="h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-yellow-600"
          />
        ))}

        {outOffsets.map((offset, index) => (
          <CustomTypedHandle
            key={`r-${offset}`}
            type="source"
            position={Position.Right}
            style={{ top: offset }}
            id={`out-${index + 1}`}
            dataType="any"
            className="h-2 w-2 -translate-y-1/2"
            indicatorClassName="border-yellow-600"
          />
        ))}

        <Dialog
          open={isEditorOpen}
          onOpenChange={setIsEditorOpen}
          modal={false}
        >
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
              <DialogTitle>Editar flujo replicado</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Modifica los nodos y conexiones de este flujo interno.
              </p>
              {nameError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  {nameError}
                </div>
              )}

              <div className="h-[60vh] w-full overflow-hidden rounded-md border">
                <ReactFlowProvider>
                  <ReactFlow
                    id={editorFlowId}
                    nodes={draftNodes.map((n) => ({
                      ...n,
                      type: (() => {
                        const t = n.type;
                        if (!t) return t;
                        const s = String(t);
                        if (nodeTypesCore[s]) return s;
                        const lower = s.trim().toLowerCase();
                        if (nodeTypesCore[lower]) return lower;
                        return s;
                      })(),
                    }))}
                    edges={draftEdges}
                    defaultEdgeOptions={{
                      markerEnd: {
                        type: MarkerType.ArrowClosed,
                        width: 14,
                        height: 14,
                      },
                    }}
                    connectionLineComponent={ArrowConnectionLine}
                    nodeTypes={{
                      ...nodeTypesCore,
                      // Permite seguir anidando subflujos si se desea.
                      subflow: NestedSubflowNode,
                    }}
                    onNodesChange={onEditorNodesChange}
                    onEdgesChange={onEditorEdgesChange}
                    onConnect={onEditorConnect}
                    isValidConnection={connectionTooltip.isValidConnection}
                    onConnectStart={connectionTooltip.onConnectStart}
                    onConnectEnd={connectionTooltip.onConnectEnd}
                    onInit={(instance) => {
                      editorInstanceRef.current = instance;
                    }}
                    onDrop={onEditorDrop}
                    onDragOver={onEditorDragOver}
                    panOnDrag={editorCanvasMode === "pan"}
                    selectionOnDrag={editorCanvasMode === "select"}
                    selectionMode={SelectionMode.Partial}
                    className={
                      editorCanvasMode === "pan"
                        ? "rf-mode-pan"
                        : "rf-mode-select"
                    }
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
                    <EditorStoreBridge
                      onNodeLookup={(lookup) => {
                        editorLookupRef.current = lookup;
                      }}
                    />
                    <Background variant={BackgroundVariant.Dots} />
                    <Controls>
                      <ControlButton
                        onClick={() => setEditorCanvasMode("pan")}
                        aria-pressed={editorCanvasMode === "pan"}
                        title="Modo arrastrar (mover canvas)"
                        className="rf-mode-toggle"
                      >
                        <Hand className="rf-icon-hand" />
                      </ControlButton>
                      <ControlButton
                        onClick={() => setEditorCanvasMode("select")}
                        aria-pressed={editorCanvasMode === "select"}
                        title="Modo selección (cuadro)"
                        className="rf-mode-toggle"
                      >
                        <MousePointer2 />
                      </ControlButton>
                    </Controls>
                  </ReactFlow>
                </ReactFlowProvider>
              </div>

              <DialogFooter>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const instance = editorInstanceRef.current as
                        | (ReactFlowInstance<EditorFlowNode, Edge> & {
                            project?: (pos: { x: number; y: number }) => {
                              x: number;
                              y: number;
                            };
                            screenToFlowPosition?: (pos: {
                              x: number;
                              y: number;
                            }) => { x: number; y: number };
                          })
                        | null;

                      let position = { x: 120, y: 120 };
                      try {
                        const el = document.getElementById(editorFlowId);
                        if (el) {
                          const rect = el.getBoundingClientRect();
                          const centerScreen = {
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2,
                          };
                          position =
                            instance?.screenToFlowPosition?.(centerScreen) ??
                            instance?.project?.(centerScreen) ??
                            position;
                        } else {
                          position =
                            instance?.project?.({ x: 120, y: 120 }) ?? position;
                        }
                      } catch {
                        position =
                          instance?.project?.({ x: 120, y: 120 }) ?? position;
                      }

                      const inputId = createInnerNodeId();
                      const existingCount = draftNodes.filter(
                        (n) => String(n.type) === "subflowInput",
                      ).length;
                      const labelText = `Entrada ${existingCount + 1}`;
                      const inputNode: Node = {
                        id: inputId,
                        type: "subflowInput",
                        position,
                        data: { label: labelText },
                      };
                      setDraftNodes((prev) => [...prev, inputNode]);
                    }}
                  >
                    <span className="mr-1">+</span>
                    Añadir entrada
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const instance = editorInstanceRef.current as
                        | (ReactFlowInstance<EditorFlowNode, Edge> & {
                            project?: (pos: { x: number; y: number }) => {
                              x: number;
                              y: number;
                            };
                            screenToFlowPosition?: (pos: {
                              x: number;
                              y: number;
                            }) => { x: number; y: number };
                          })
                        | null;

                      let position = { x: 200, y: 120 };
                      try {
                        const el = document.getElementById(editorFlowId);
                        if (el) {
                          const rect = el.getBoundingClientRect();
                          const centerScreen = {
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2,
                          };
                          position =
                            instance?.screenToFlowPosition?.(centerScreen) ??
                            instance?.project?.(centerScreen) ??
                            position;
                        } else {
                          position =
                            instance?.project?.({ x: 200, y: 120 }) ?? position;
                        }
                      } catch {
                        position =
                          instance?.project?.({ x: 200, y: 120 }) ?? position;
                      }

                      const outputId = createInnerNodeId();
                      const outputNode: Node = {
                        id: outputId,
                        type: "subflowOutput",
                        position,
                        data: { label: "Salida" },
                      };
                      setDraftNodes((prev) => [...prev, outputNode]);
                    }}
                  >
                    <Split className="mr-1 h-4 w-4" />
                    Añadir salida
                  </Button>

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
                      const lookup = editorLookupRef.current;
                      // Compute inCount from explicit `subflowInput` nodes added by the user.
                      const explicitInputs = draftNodes.filter(
                        (n) => String(n.type) === "subflowInput",
                      ).length;
                      const nextInCount = Number.isFinite(
                        Number(explicitInputs),
                      )
                        ? explicitInputs
                        : Number.isFinite(rawInCount)
                          ? (rawInCount as number)
                          : inCount;

                      // If there are explicit subflowOutput nodes, expose exactly one salida.
                      const explicitOutputs = draftNodes.filter(
                        (n) => String(n.type) === "subflowOutput",
                      ).length;

                      // For outputs keep the previous behavior (try to compute open ports)
                      // when no explicit subflowOutput nodes exist.
                      let nextOutCount =
                        explicitOutputs > 0
                          ? 1
                          : Number.isFinite(rawOutCount)
                            ? (rawOutCount as number)
                            : outCount;
                      try {
                        const computed = computeOpenPortsFromLookup(
                          draftNodes,
                          draftEdges,
                          lookup,
                        );
                        if (
                          computed &&
                          computed.ready &&
                          explicitOutputs === 0
                        ) {
                          nextOutCount = computed.outCount;
                        }
                      } catch {
                        // ignore
                      }

                      const finalLabel = (draftLabel || label).trim() || label;

                      // Prevent saving if any subflow input labels are empty
                      const hasEmptyInputs = draftNodes.some(
                        (n) =>
                          String(n.type) === "subflowInput" &&
                          !String((n.data ?? {}).label ?? "").trim(),
                      );
                      if (hasEmptyInputs) {
                        setNameError(
                          "Hay entradas sin nombre. Asigna un nombre a todas las entradas antes de guardar.",
                        );
                        return;
                      }

                      // Prevent saving if there are more than one open outputs
                      if (Number(nextOutCount) > 1) {
                        setNameError(
                          "El nodo Replicar flujo no puede exponer más de 1 salida. Unifica o cierra salidas antes de guardar.",
                        );
                        return;
                      }

                      setNodes((prev) =>
                        prev.map((n) => {
                          if (n.id !== id) {
                            return n;
                          }

                          return {
                            ...n,
                            data: {
                              ...(n.data as object),
                              label: finalLabel,
                              subflowNodes: draftNodes,
                              subflowEdges: draftEdges,
                              inCount: nextInCount,
                              outCount: nextOutCount,
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
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </BaseNode>
    );
  },
);

ReplicateFlowNode.displayName = "ReplicateFlowNode";
