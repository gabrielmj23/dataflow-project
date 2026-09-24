import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Edge, Node, NodeProps, OnNodeDrag } from "@xyflow/react";
import {
  addEdge,
  applyEdgeChanges,
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
  useStore,
  Position,
} from "@xyflow/react";
import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { Hand, MousePointer2, PictureInPicture2, Split } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  buildDroppedNodeData,
  editorPaletteLabelByType,
  normalizeNodeTypeForEditor,
  projectClientToFlowPosition,
} from "@/flow/editor-node-factory";
import { nodeTypesCore } from "@/flow/node-types-core";
import { resolvePreviousLabelForGlobalUpdate } from "@/flow/subflow-global-update";
import { validateSubflowDraftForSave } from "@/flow/subflow-save-validation";
import { useSubflowTemplateContext } from "@/flow/subflow-templates-context";
import { Input } from "@/components/ui/input";
import { ArrowConnectionLine } from "@/flow/arrow-connection-line";
import { deleteDraggedNodesOutsideViewport } from "@/flow/drag-delete";
import { useSharedEdgeConfig } from "@/hooks/useSharedEdgeConfig";
import { useSubcanvasNodeCreationLock } from "@/hooks/useSubcanvasNodeCreationLock";
import { validateConnection } from "@/flow/connection-validation";
import { ConnectionErrorTooltip } from "@/flow/connection-error-tooltip";
import { useConnectionValidationTooltip } from "@/flow/use-connection-validation-tooltip";
import { reconcileWriteGraph } from "@/utils/flow";
import {
  createConditionalPair,
  filterLockedEdgeChanges,
  handlePairedNodeChanges,
} from "@/utils/conditional-pair";
import { toast } from "sonner";

export type NestedSubflowNodeData = {
  label?: string;
  inCount?: number;
  outCount?: number;
  subflowNodes?: Node[];
  subflowEdges?: Edge[];
  templateId?: string;
  isSelfCall?: boolean;
};

type NestedSubflowRfNode = Node<NestedSubflowNodeData>;

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

export const NestedSubflowNode = memo(
  ({ id, data }: NodeProps<NestedSubflowRfNode>) => {
    const { setNodes } = useReactFlow();
    const templateContext = useSubflowTemplateContext();

    const {
      label = "Subflujo",
      inCount: rawInCount,
      outCount: rawOutCount,
      subflowNodes,
      subflowEdges,
      templateId,
      isSelfCall = false,
    } = (data ?? {}) as NestedSubflowNodeData;

    const inCount = Number.isFinite(rawInCount) ? (rawInCount as number) : 0;
    const outCount = Number.isFinite(rawOutCount) ? (rawOutCount as number) : 0;

    const inOffsets = offsets(inCount);
    const outOffsets = offsets(outCount);

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    useSubcanvasNodeCreationLock(isEditorOpen);
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
    const [isGlobalUpdateConfirmOpen, setIsGlobalUpdateConfirmOpen] =
      useState(false);
    const [globalUpdatePreviousLabel, setGlobalUpdatePreviousLabel] = useState<
      string | null
    >(null);

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
    const sharedEdgeConfig = useSharedEdgeConfig<Edge>(setDraftEdges);

    const editorFlowId = useMemo(() => `nested-subflow-editor-${id}`, [id]);

    const paletteLabelByType = editorPaletteLabelByType;

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
      let candidate = `inner-nested-${id}-${next}`;
      while (existing.has(candidate)) {
        next = nextInnerIdRef.current++;
        candidate = `inner-nested-${id}-${next}`;
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

        const templateIdRaw = event.dataTransfer.getData(
          "application/subflow-template-id",
        );
        const templateId = templateIdRaw || null;

        const position = projectClientToFlowPosition(
          editorInstanceRef.current,
          event.clientX,
          event.clientY,
        );

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
          data: buildDroppedNodeData({
            type,
            templateId,
            paletteLabelByType,
            resolveSubflowTemplate: templateContext?.resolveTemplate,
          }),
        };

        setDraftNodes((prev) => [...prev, newNode]);
      },
      [
        createInnerNodeId,
        paletteLabelByType,
        setDraftNodes,
        setDraftEdges,
        templateContext,
      ],
    );

    const onEditorNodeDragStop: OnNodeDrag<EditorFlowNode> = (
      event,
      node,
      draggedNodes,
    ) => {
      const nodesToEvaluate: Node[] =
        Array.isArray(draggedNodes) && draggedNodes.length > 0
          ? draggedNodes
          : [node];

      deleteDraggedNodesOutsideViewport({
        event,
        draggedNodes: nodesToEvaluate,
        reactFlowInstance: editorInstanceRef.current,
        setNodes: setDraftNodes,
        setEdges: setDraftEdges,
        viewportElement: document.getElementById(editorFlowId),
      });
    };

    const saveNestedSubflowDefinition = (mode: "local" | "global"): boolean => {
      const draftValidation = validateSubflowDraftForSave({
        nodes: draftNodes,
        edges: draftEdges,
        lookup: editorLookupRef.current,
        draftLabel,
        currentLabel: label,
        rawInCount,
        rawOutCount,
        fallbackInCount: inCount,
        fallbackOutCount: outCount,
      });
      if (!draftValidation.ok) {
        setNameError(draftValidation.error);
        return false;
      }

      const { finalLabel, nextInCount, nextOutCount, edgesForSave } =
        draftValidation;
      const previousLabelForGlobal = resolvePreviousLabelForGlobalUpdate({
        mode,
        currentLabel: label,
        previousLabel: globalUpdatePreviousLabel,
      });

      const normalizedTemplateId =
        typeof templateId === "string" && templateId.trim().length > 0
          ? templateId.trim()
          : null;

      const templateToUpdateGlobally =
        mode === "global" && templateContext
          ? ((normalizedTemplateId
              ? templateContext.resolveTemplate(normalizedTemplateId)
              : null) ??
            templateContext.resolveTemplateByName(previousLabelForGlobal) ??
            templateContext.resolveTemplateByName(finalLabel))
          : null;

      if (templateContext) {
        const sameNameTemplate =
          templateContext.resolveTemplateByName(finalLabel);
        if (sameNameTemplate) {
          if (mode === "global") {
            const allowedTemplateId =
              templateToUpdateGlobally?.id ?? normalizedTemplateId;
            if (
              !allowedTemplateId ||
              sameNameTemplate.id !== allowedTemplateId
            ) {
              setNameError(
                "Ya existe un subflujo con ese nombre en la paleta o en el canvas. Elige otro nombre.",
              );
              return false;
            }
          } else if (
            !normalizedTemplateId ||
            sameNameTemplate.id !== normalizedTemplateId
          ) {
            setNameError(
              "Ya existe un subflujo con ese nombre en la paleta o en el canvas. Elige otro nombre.",
            );
            return false;
          }
        }
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
              subflowEdges: edgesForSave,
              inCount: nextInCount,
              outCount: nextOutCount,
              ...(normalizedTemplateId
                ? { templateId: normalizedTemplateId }
                : {}),
            },
          };
        }),
      );

      if (mode === "global" && templateContext) {
        const globalResult = templateContext.applyGlobalSubflowUpdate({
          templateId: normalizedTemplateId,
          previousLabel: previousLabelForGlobal,
          nextLabel: finalLabel,
          inCount: nextInCount,
          outCount: nextOutCount,
          nodes: draftNodes,
          edges: edgesForSave,
        });

        if (globalResult.disconnected) {
          toast.warning(
            "Definicion global actualizada. Se desconectaron nodos con cambios en entradas/salidas.",
          );
        } else {
          toast.success("Definicion global actualizada.");
        }
      }

      setIsEditorOpen(false);
      setIsGlobalUpdateConfirmOpen(false);
      setGlobalUpdatePreviousLabel(null);
      setNameError(null);
      return true;
    };

    return (
      <BaseNode
        className="relative flex w-36 flex-col items-center justify-center rounded-xl border-violet-700 bg-violet-500 px-3 py-2 text-center text-white shadow-md"
        onConfigClick={
          !isSelfCall
            ? () => {
                setDraftNodes(subflowNodes ?? []);
                setDraftEdges(subflowEdges ?? []);
                setDraftLabel(label);
                setIsGlobalUpdateConfirmOpen(false);
                setGlobalUpdatePreviousLabel(label);
                setIsEditorOpen(true);
              }
            : undefined
        }
      >
        <div className="flex flex-col items-center gap-0.5">
          {!isSelfCall ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="Configurar nodo"
              className="nodrag nopan text-2xl font-bold leading-none cursor-pointer transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              onClick={(event) => {
                event.stopPropagation();
                setDraftNodes(subflowNodes ?? []);
                setDraftEdges(subflowEdges ?? []);
                setDraftLabel(label);
                setIsGlobalUpdateConfirmOpen(false);
                setGlobalUpdatePreviousLabel(label);
                setIsEditorOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  setDraftNodes(subflowNodes ?? []);
                  setDraftEdges(subflowEdges ?? []);
                  setDraftLabel(label);
                  setIsGlobalUpdateConfirmOpen(false);
                  setGlobalUpdatePreviousLabel(label);
                  setIsEditorOpen(true);
                }
              }}
            >
              <PictureInPicture2 />
            </div>
          ) : (
            <div className="text-2xl font-bold leading-none">
              <PictureInPicture2 />
            </div>
          )}
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
            indicatorClassName="border-violet-700"
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
            indicatorClassName="border-violet-700"
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
              <DialogTitle>Editar subflujo anidado</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Modifica los nodos y conexiones de este subflujo.
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-900">
                  Nombre del subflujo:
                </label>
                <Input
                  value={draftLabel}
                  onChange={(e) => {
                    setDraftLabel(e.currentTarget.value);
                    setNameError(null);
                  }}
                  placeholder="Ej: Validar datos"
                />
              </div>
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
                      type: normalizeNodeTypeForEditor(n.type, nodeTypesCore),
                    }))}
                    edges={draftEdges}
                    {...sharedEdgeConfig}
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
                    onNodeDragStop={onEditorNodeDragStop}
                    autoPanOnNodeDrag={false}
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
                    onClick={() => {
                      setIsGlobalUpdateConfirmOpen(false);
                      setGlobalUpdatePreviousLabel(null);
                      setIsEditorOpen(false);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      saveNestedSubflowDefinition("local");
                    }}
                  >
                    Guardar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setNameError(null);
                      setGlobalUpdatePreviousLabel(label);
                      setIsGlobalUpdateConfirmOpen(true);
                    }}
                  >
                    Actualizar definicion global
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={isGlobalUpdateConfirmOpen}
          onOpenChange={(open) => {
            setIsGlobalUpdateConfirmOpen(open);
            if (!open) {
              setGlobalUpdatePreviousLabel(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Actualizar definicion global</DialogTitle>
              <DialogDescription>
                Al actualizar la definicion del subflujo puedes dejar tu
                programa en un estado inestable si alteras las entradas o
                salidas.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Si cambia la cantidad de entradas o salidas, se desconectaran los
              cables de los nodos afectados para evitar errores.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsGlobalUpdateConfirmOpen(false);
                  setGlobalUpdatePreviousLabel(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  saveNestedSubflowDefinition("global");
                }}
              >
                Actualizar definicion global
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </BaseNode>
    );
  },
);

NestedSubflowNode.displayName = "NestedSubflowNode";
