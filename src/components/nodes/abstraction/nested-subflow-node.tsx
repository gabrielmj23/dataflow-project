import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DragEvent } from "react";
import type { Edge, Node, NodeProps } from "@xyflow/react";
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
  useStore,
  Handle,
  Position,
} from "@xyflow/react";

import { BaseNode, BaseNodeHeader } from "@/components/base-node";
import { Hand, MousePointer2, PictureInPicture2 } from "lucide-react";
import NodeSettingsButton from "@/components/ui/node-settings-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nodePalette } from "@/flow/node-palette";
import { nodeTypesCore } from "@/flow/node-types-core";
import { computeOpenPortsFromLookup } from "@/flow/subflow-utils";
import { Input } from "@/components/ui/input";

export type NestedSubflowNodeData = {
  label?: string;
  inCount?: number;
  outCount?: number;
  subflowNodes?: Node[];
  subflowEdges?: Edge[];
};

type NestedSubflowRfNode = Node<NestedSubflowNodeData>;

function EditorStoreBridge({
  onNodeLookup,
}: {
  onNodeLookup: (lookup: unknown) => void;
}) {
  const nodeLookup = useStore(
    (state) => (state as unknown as { nodeLookup: unknown }).nodeLookup
  );

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

    const {
      label = "Subflujo",
      inCount: rawInCount,
      outCount: rawOutCount,
      subflowNodes,
      subflowEdges,
    } = (data ?? {}) as NestedSubflowNodeData;

    const inCount = Number.isFinite(rawInCount) ? (rawInCount as number) : 3;
    const outCount = Number.isFinite(rawOutCount) ? (rawOutCount as number) : 3;

    const inOffsets = offsets(inCount);
    const outOffsets = offsets(outCount);

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editorCanvasMode, setEditorCanvasMode] = useState<
      "pan" | "select"
    >("pan");
    const [draftNodes, setDraftNodes] = useState<Node[]>(
      () => subflowNodes ?? []
    );
    const [draftEdges, setDraftEdges] = useState<Edge[]>(
      () => subflowEdges ?? []
    );
    const [draftLabel, setDraftLabel] = useState(label);

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

    const editorLookupRef = useRef<unknown>(null);

    const onEditorNodesChange = useCallback((changes: NodeChange[]) => {
      setDraftNodes((snapshot) => applyNodeChanges(changes, snapshot));
    }, []);

    const onEditorEdgesChange = useCallback((changes: EdgeChange[]) => {
      setDraftEdges((snapshot) => applyEdgeChanges(changes, snapshot));
    }, []);

    const onEditorConnect = useCallback((params: Connection) => {
      setDraftEdges((snapshot) => addEdge(params, snapshot));
    }, []);

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

    const editorInstanceRef = useRef<ReactFlowInstance | null>(null);
    const nextInnerIdRef = useRef(1);

    const createInnerNodeId = useCallback(() => {
      const next = nextInnerIdRef.current++;
      return `inner-nested-${id}-${next}`;
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
        const newNode: Node = {
          id: createInnerNodeId(),
          type,
          position,
          data: nodeLabel ? { label: nodeLabel } : {},
        };

        setDraftNodes((prev) => [...prev, newNode]);
      },
      [createInnerNodeId, paletteLabelByType]
    );

    return (
      <BaseNode className="relative flex w-36 flex-col items-center justify-center rounded-xl border-violet-700 bg-violet-500 px-3 py-2 text-center text-white shadow-md">
        <BaseNodeHeader className="absolute top-1 right-1 mx-0 my-0 p-0">
          <NodeSettingsButton
            onClick={() => {
              setDraftNodes(subflowNodes ?? []);
              setDraftEdges(subflowEdges ?? []);
              setDraftLabel(label);
              setIsEditorOpen(true);
            }}
          />
        </BaseNodeHeader>
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-xl font-bold leading-none">
            <PictureInPicture2 />
          </div>
          <div className="text-sm leading-tight">{label}</div>
        </div>

        {inOffsets.map((offset, index) => (
          <Handle
            key={`l-${offset}`}
            type="target"
            position={Position.Left}
            style={{ top: offset }}
            id={`in-${index + 1}`}
            className="h-2 w-2 -translate-y-1/2 rounded-full border border-violet-700 bg-white"
          />
        ))}

        {outOffsets.map((offset, index) => (
          <Handle
            key={`r-${offset}`}
            type="source"
            position={Position.Right}
            style={{ top: offset }}
            id={`out-${index + 1}`}
            className="h-2 w-2 -translate-y-1/2 rounded-full border border-violet-700 bg-white"
          />
        ))}

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
                  onChange={(e) => setDraftLabel(e.currentTarget.value)}
                  placeholder="Ej: Validar datos"
                />
              </div>

              <div className="h-[60vh] w-full overflow-hidden rounded-md border">
                <ReactFlowProvider>
                  <ReactFlow
                    id={editorFlowId}
                    nodes={draftNodes}
                    edges={draftEdges}
                    nodeTypes={{
                      ...nodeTypesCore,
                      // Permite seguir anidando subflujos si se desea.
                      subflow: NestedSubflowNode,
                    }}
                    onNodesChange={onEditorNodesChange}
                    onEdgesChange={onEditorEdgesChange}
                    onConnect={onEditorConnect}
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
                    const lookup = editorLookupRef.current;
                    const computed = computeOpenPortsFromLookup(
                      draftNodes,
                      draftEdges,
                      lookup
                    );
                    const nextInCount = computed.ready
                      ? computed.inCount
                      : Number.isFinite(rawInCount)
                      ? (rawInCount as number)
                      : inCount;
                    const nextOutCount = computed.ready
                      ? computed.outCount
                      : Number.isFinite(rawOutCount)
                      ? (rawOutCount as number)
                      : outCount;

                    const finalLabel = (draftLabel || label).trim() || label;

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
      </BaseNode>
    );
  }
);

NestedSubflowNode.displayName = "NestedSubflowNode";
