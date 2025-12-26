import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type { Edge, Node, NodeProps } from "@xyflow/react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type ReactFlowInstance,
  useReactFlow,
} from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { nodePalette } from "@/flow/node-palette";
import { nodeTypesCore } from "@/flow/node-types-core";
import { ListInputValueNode } from "@/components/nodes/iteration/list-input-value-node";

export type FilterNodeData = {
  label?: string;
  filterNodes?: Node[];
  filterEdges?: Edge[];
};

const FILTER_INPUT_NODE_ID = "filter-input-value";

export const FilterNode = memo(({ id, data }: NodeProps) => {
  const { setNodes } = useReactFlow();

  const {
    label = "Filtrar",
    filterNodes,
    filterEdges,
  } = (data ?? {}) as FilterNodeData;

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftNodes, setDraftNodes] = useState<Node[]>(() => filterNodes ?? []);
  const [draftEdges, setDraftEdges] = useState<Edge[]>(() => filterEdges ?? []);

  const onEditorNodesChange = useCallback((changes: NodeChange[]) => {
    const removingMandatoryInput = changes.some(
      (change) =>
        change.type === "remove" &&
        "id" in change &&
        change.id === FILTER_INPUT_NODE_ID
    );

    setDraftNodes((snapshot) => {
      const next = applyNodeChanges(changes, snapshot);
      if (removingMandatoryInput) {
        return next.some((n) => n.id === FILTER_INPUT_NODE_ID)
          ? next
          : [
              {
                id: FILTER_INPUT_NODE_ID,
                type: "filterInputValue",
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

  const onEditorConnect = useCallback((params: Connection) => {
    setDraftEdges((snapshot) => addEdge(params, snapshot));
  }, []);

  const editorFlowId = useMemo(() => `filter-editor-${id}`, [id]);

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
    return `inner-filter-${id}-${next}`;
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

  const isSidebarEventTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return Boolean(
      target.closest(
        '[data-slot="sidebar-container"], [data-slot="sidebar"], [data-slot="sidebar-inner"], [data-slot="sidebar-wrapper"], [data-sidebar]'
      )
    );
  }, []);

  const editorNodeTypes = useMemo(
    () => ({
      ...nodeTypesCore,
      filterInputValue: ListInputValueNode,
    }),
    []
  );

  // Delete selected nodes/edges with Backspace/Delete when editor is open
  useEffect(() => {
    if (!isEditorOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;

      // Prevent the main canvas key handler (in App.tsx) from also deleting
      // whatever is selected there while we're interacting with this modal.
      e.preventDefault();
      e.stopImmediatePropagation();

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

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
        icon={<span className="text-lg font-bold">↓</span>}
        label={label}
        variant="singleInSingleOut"
        onConfigClick={() => {
          const baseNodes = filterNodes ?? [];
          const hasInput = baseNodes.some((n) => n.id === FILTER_INPUT_NODE_ID);
          const ensuredNodes = hasInput
            ? baseNodes.map((n) =>
                n.id === FILTER_INPUT_NODE_ID
                  ? { ...n, type: "filterInputValue" }
                  : n
              )
            : [
                {
                  id: FILTER_INPUT_NODE_ID,
                  type: "filterInputValue",
                  position: { x: 0, y: 0 },
                  data: { label: "Valor de entrada" },
                  selected: false,
                } satisfies Node,
                ...baseNodes,
              ];

          setDraftNodes(ensuredNodes);
          setDraftEdges(filterEdges ?? []);
          setIsEditorOpen(true);
        }}
      />

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen} modal={false}>
        <DialogContent
          className="sm:max-w-4xl"
          onPointerDownOutside={(event) => {
            if (isSidebarEventTarget(event.target)) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (isSidebarEventTarget(event.target)) {
              event.preventDefault();
            }
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
                <ReactFlow
                  id={editorFlowId}
                  nodes={draftNodes}
                  edges={draftEdges}
                  nodeTypes={editorNodeTypes}
                  onNodesChange={onEditorNodesChange}
                  onEdgesChange={onEditorEdgesChange}
                  onConnect={onEditorConnect}
                  onInit={(instance) => {
                    editorInstanceRef.current = instance;
                  }}
                  onDrop={onEditorDrop}
                  onDragOver={onEditorDragOver}
                  fitView
                  proOptions={{ hideAttribution: true }}
                >
                  <Background variant={BackgroundVariant.Dots} />
                  <Controls />
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
                  const ensured = draftNodes.some(
                    (n) => n.id === FILTER_INPUT_NODE_ID
                  )
                    ? draftNodes
                    : [
                        {
                          id: FILTER_INPUT_NODE_ID,
                          type: "filterInputValue",
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
                          filterNodes: ensured,
                          filterEdges: draftEdges,
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

FilterNode.displayName = "FilterNode";
