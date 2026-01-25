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
  useStore,
  useUpdateNodeInternals,
  Position,
} from "@xyflow/react";
import { BaseNode, BaseNodeHeader } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { Hand, MousePointer2, PictureInPicture2, RefreshCw } from "lucide-react";
import NodeSettingsButton from "@/components/ui/node-settings-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nodeTypesCore } from "@/flow/node-types-core";
import { computeOpenPortsFromLookup } from "@/flow/subflow-utils";
import { nodePalette } from "@/flow/node-palette";
import { Input } from "@/components/ui/input";
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

export type SubflowNodeData = {
  label?: string;
  inCount?: number;
  outCount?: number;
  subflowNodes?: Node[];
  subflowEdges?: Edge[];
  templateId?: string;
  isSelfCall?: boolean;
};

type SubflowRfNode = Node<SubflowNodeData>;

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

export const SubflowNode = memo(({ id, data }: NodeProps<SubflowRfNode>) => {
  const { setNodes, setEdges } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const templateContext = useSubflowTemplateContext();

  const {
    label = "Subflujo",
    inCount: rawInCount,
    outCount: rawOutCount,
    subflowNodes,
    subflowEdges,
    templateId,
    isSelfCall = false,
  } = (data ?? {}) as SubflowNodeData;

  const inCount = Number.isFinite(rawInCount) ? (rawInCount as number) : 0;
  const outCount = Number.isFinite(rawOutCount) ? (rawOutCount as number) : 0;

  const inOffsets = offsets(inCount);
  const outOffsets = offsets(outCount);

  // Extract explicit `subflowInput` nodes (created in the editor) and
  // order them top-to-bottom so they map to the left handles deterministically.
  const explicitInputNodes = useMemo(() => {
    const list = Array.isArray(subflowNodes) ? subflowNodes.slice() : [];
    const inputs = list.filter((n) => String(n.type) === "subflowInput");
    inputs.sort((a, b) => {
      const ay = (a.position?.y ?? 0) as number;
      const by = (b.position?.y ?? 0) as number;
      if (ay !== by) return ay - by;
      const ax = (a.position?.x ?? 0) as number;
      const bx = (b.position?.x ?? 0) as number;
      return ax - bx;
    });
    return inputs;
  }, [subflowNodes]);

  const selfTemplateId = useMemo(
    () =>
      typeof templateId === "string" && templateId.trim().length > 0
        ? templateId.trim()
        : String(id),
    [id, templateId],
  );

  // Ensure XYFlow recomputes handle bounds whenever the number of ports changes.
  const explicitInputCount = explicitInputNodes.length;
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, inCount, outCount, explicitInputCount, updateNodeInternals]);

  const minHeight = useMemo(() => {
    const base = 64; // a bit taller base than before
    const perInput = 18; // extra height per input
    const count = Number.isFinite(Number(explicitInputCount)) && explicitInputCount > 0 ? explicitInputCount : inCount;
    return base + Math.max(0, count - 1) * perInput;
  }, [explicitInputCount, inCount]);

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
  const [addToPalette, setAddToPalette] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const connectionTooltip = useConnectionValidationTooltip(draftNodes);
  const [connectionHighlight, setConnectionHighlight] =
    useState<ConnectionHighlightState>(null);

  // Keep Write nodes inside the subflow editor aligned with their connections
  // so variable chips and input handles stay in sync.
  useEffect(() => {
    const result = reconcileWriteGraph(draftNodes, draftEdges);
    if (result.changedEdges) setDraftEdges(result.edges as Edge[]);
    if (result.changedNodes) setDraftNodes(result.nodes as Node[]);
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

  const editorLookupRef = useRef<unknown>(null);

  const onEditorNodesChange = useCallback((changes: NodeChange[]) => {
    setDraftNodes((snapshot) => applyNodeChanges(changes, snapshot));
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

  const editorFlowId = useMemo(() => `subflow-editor-${id}`, [id]);

  // Ensure draft nodes use canonical type keys that exist in `nodeTypesCore`.
  const normalizeNodeType = useCallback((t: unknown) => {
    if (!t) return t;
    const s = String(t);
    if ((nodeTypesCore as any)[s]) return s;
    const lower = s.trim().toLowerCase();
    if ((nodeTypesCore as any)[lower]) return lower;
    return s;
  }, []);

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
    return `inner-${id}-${next}`;
  }, [id]);

  const insertSelfInstance = useCallback(() => {
    // Insert a self-call node: it signals the engine to re-enter this same
    // subflow/template. This node should not expose its own editor.
    const resolvedFromTemplate =
      templateContext && selfTemplateId
        ? templateContext.resolveTemplate(selfTemplateId)
        : null;

    const instance = editorInstanceRef.current as
      | (ReactFlowInstance & {
          project?: (pos: { x: number; y: number }) => { x: number; y: number };
        })
      | null;

    const position = instance?.project?.({ x: 200, y: 200 }) ?? { x: 200, y: 200 };

    const nextLabel = (draftLabel || resolvedFromTemplate?.name || label).trim() || label;

    // Determine desired exposed port counts for the self-call instance.
    // Use explicit `subflowInput` nodes count (added via editor) for inputs,
    // falling back to the node's current `inCount`/`outCount` when unknown.
    let desiredIn = inCount;
    let desiredOut = outCount;
    try {
      const explicitInputs = draftNodes.filter((n) => String(n.type) === "subflowInput").length;
      if (explicitInputs >= 0) {
        desiredIn = explicitInputs;
      }
      // Keep existing out count behavior (no explicit output nodes for now)
    } catch {
      // ignore and fall back to existing counts
    }

    const newNode: Node = {
      id: createInnerNodeId(),
      type: "subflow",
      position,
      data: {
        label: nextLabel,
        inCount: desiredIn,
        outCount: desiredOut,
        templateId: selfTemplateId,
        isSelfCall: true,
      },
    };

    setDraftNodes((prev) => [...prev, newNode]);
  }, [createInnerNodeId, editorInstanceRef, inCount, outCount, label, draftLabel, setDraftNodes, selfTemplateId, templateContext]);

  // Keep labels/counts of self-call nodes in sync with the current draft name
  // and port counts, so they update automatically when the subflow is renamed.
  useEffect(() => {
    if (!selfTemplateId) return;
    const nextLabel = (draftLabel || label).trim() || label;

    // When the subflow isn't a persisted template yet, keep self-call
    // instances without ports (inCount/outCount = 0). If a template id is
    // present (persisted), reflect the actual port counts.
    const desiredIn = templateId ? inCount : 0;
    const desiredOut = templateId ? outCount : 0;

    setDraftNodes((prev) =>
      prev.map((node) => {
        if (node.type !== "subflow") return node;
        const nodeData = (node.data ?? {}) as SubflowNodeData;
        if (!nodeData.isSelfCall) return node;
        const nodeTemplateId =
          typeof nodeData.templateId === "string"
            ? nodeData.templateId.trim()
            : null;
        if (nodeTemplateId !== selfTemplateId) return node;

        return {
          ...node,
          data: {
            ...(node.data ?? {}),
            label: nextLabel,
            inCount: desiredIn,
            outCount: desiredOut,
          },
        };
      }),
    );
  }, [draftLabel, label, inCount, outCount, selfTemplateId, templateId, setDraftNodes]);

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

      if (type === "conditionalPair") {
        const conditionalId = createInnerNodeId();
        const selectorId = createInnerNodeId();
        const pairId = createInnerNodeId();

        const conditionalNode: Node = {
          id: conditionalId,
          type: "conditional",
          position,
          data: { label: "Condicional", pairId, pairRole: "conditional", pairOffsetY: 160 },
        };

        const selectorNode: Node = {
          id: selectorId,
          type: "selector",
          position: { x: position.x, y: position.y + 160 },
          data: { label: "Selector", pairId, pairRole: "selector", pairOffsetY: 160 },
        };

        const edge = {
          id: createInnerNodeId(),
          source: conditionalId,
          sourceHandle: "out",
          target: selectorId,
          targetHandle: "token",
          type: "default",
          data: { edgeType: "straight", pairId, locked: true },
        } as Node & { // typed as Node for draftEdges array
          // placeholder
        };

        setDraftNodes((prev) => [...prev, conditionalNode, selectorNode]);
        setDraftEdges((prev) => [...prev, edge as any]);
        return;
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

  return (
    <BaseNode
      className="relative flex w-72 flex-col items-center justify-center rounded-xl border-violet-700 bg-violet-500 px-3 py-2 text-center text-white shadow-md"
      style={{ minHeight: `${minHeight}px` }}
    >
      {!isSelfCall ? (
        <BaseNodeHeader className="absolute top-1 right-1 mx-0 my-0 p-0">
          <NodeSettingsButton
            onClick={() => {
              setDraftNodes(subflowNodes ?? []);
              setDraftEdges(subflowEdges ?? []);
              setDraftLabel(label);
              setAddToPalette(false);
              setNameError(null);
              setIsEditorOpen(true);
            }}
          />
        </BaseNodeHeader>
      ) : null}
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-xl font-bold leading-none">
          <PictureInPicture2 />
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
          indicatorClassName="border-violet-700"
        />
      ))}

      {/* Render input labels aligned with left handles (editable) */}
      {inOffsets.map((offset, index) => {
        const inputNode = explicitInputNodes[index];
        const label = inputNode ? String(((inputNode.data ?? {}) as any).label ?? `Entrada ${index + 1}`) : `Entrada ${index + 1}`;
        const trimmed = String(label ?? "").trim();
        const len = Math.max(0, trimmed.length);
        const widthPx = len <= 1 ? 36 : Math.min(140, 12 + len * 8);

        return (
          <Input
            key={`in-label-${index}`}
            value={label}
            readOnly
            tabIndex={-1}
            className="nodrag absolute h-6 -translate-y-1/2 border-0 bg-transparent px-2 text-left text-[10px] text-white placeholder:text-white/60 focus:outline-none pointer-events-none shadow-none"
            style={{
              top: `calc(${offset} + 9px)`,
              left: "12px",
              width: `${widthPx}px`,
              transform: "translate(0, -50%)",
            }}
          />
        );
      })}

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
            <DialogTitle>Editar subflujo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Modifica los nodos y conexiones.
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
            <label className="mt-1 flex items-center gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={addToPalette}
                onChange={(e) => {
                  setAddToPalette(e.currentTarget.checked);
                  setNameError(null);
                }}
              />
              <span>Añadir este subflujo a la paleta</span>
            </label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={insertSelfInstance}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                Insertar este subflujo
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
              onClick={() => {
                const instance = editorInstanceRef.current as
                  | (ReactFlowInstance & {
                      project?: (pos: { x: number; y: number }) => { x: number; y: number };
                      screenToFlowPosition?: (pos: { x: number; y: number }) => { x: number; y: number };
                    })
                  | null;

                // Compute center of the editor container and project to flow coords.
                let position = { x: 120, y: 120 };
                try {
                  const el = document.getElementById(editorFlowId);
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    const centerScreen = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                    position = instance?.screenToFlowPosition?.(centerScreen) ?? instance?.project?.(centerScreen) ?? position;
                  } else {
                    position = instance?.project?.({ x: 120, y: 120 }) ?? position;
                  }
                } catch {
                  position = instance?.project?.({ x: 120, y: 120 }) ?? position;
                }

                const inputId = createInnerNodeId();
                const existingCount = draftNodes.filter((n) => String(n.type) === "subflowInput").length;
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
              {!templateId ? (
                <span className="text-xs text-muted-foreground">
                  Se insertará la definición actual (no guardada).
                </span>
              ) : null}
            </div>

            <div className="h-[60vh] w-full overflow-hidden rounded-md border">
              <ReactFlowProvider>
                <ConnectionHighlightProvider value={connectionHighlight}>
                  <ReactFlow
                    id={editorFlowId}
                    nodes={draftNodes.map((n) => ({ ...n, type: normalizeNodeType(n.type) }))}
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
                      subflow: NestedSubflowNode,
                    }}
                    edgeTypes={{
                      default: LabeledEdge,
                    }}
                    onNodesChange={onEditorNodesChange}
                    onEdgesChange={onEditorEdgesChange}
                    onConnect={onEditorConnect}
                    isValidConnection={connectionTooltip.isValidConnection}
                    onConnectStart={onEditorConnectStart}
                    onConnectEnd={onEditorConnectEnd}
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
                </ConnectionHighlightProvider>
              </ReactFlowProvider>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsEditorOpen(false);
                  setNameError(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  // Compute inCount from explicit `subflowInput` nodes added by the user.
                  const explicitInputs = draftNodes.filter((n) => String(n.type) === "subflowInput").length;
                  const nextInCount = Number.isFinite(Number(explicitInputs)) ? explicitInputs : (Number.isFinite(rawInCount) ? (rawInCount as number) : inCount);

                  // For outputs keep the previous behavior (try to compute open ports),
                  // but only as a best-effort fallback.
                  const lookup = editorLookupRef.current;
                  let nextOutCount = Number.isFinite(rawOutCount) ? (rawOutCount as number) : outCount;
                  try {
                    const computed = computeOpenPortsFromLookup(draftNodes, draftEdges, lookup);
                    if (computed && computed.ready) {
                      nextOutCount = computed.outCount;
                    }
                  } catch {
                    // ignore
                  }

                  const finalLabel = (draftLabel || label).trim() || label;

                  // Prevent saving if any subflow input labels are empty
                  const hasEmptyInputs = draftNodes.some((n) => String(n.type) === "subflowInput" && !(String(((n.data ?? {}) as any).label ?? "").trim()));
                  if (hasEmptyInputs) {
                    setNameError("Hay entradas sin nombre. Asigna un nombre a todas las entradas antes de guardar.");
                    return;
                  }

                    // Prevent saving if there are more than one open outputs
                    if (Number(nextOutCount) > 1) {
                      setNameError("El subflujo no puede exponer más de 1 salida. Unifica o cierra salidas antes de guardar.");
                      return;
                    }

                  if (addToPalette && templateContext) {
                    if (templateContext.isNameTaken(finalLabel)) {
                      setNameError(
                        "Ya existe un subflujo en la paleta con ese nombre. Elige otro nombre."
                      );
                      return;
                    }

                    const baseId = templateId || `sf-node-${String(id)}`;
                    const uniqueId = `${baseId}-${Date.now().toString(36)}`;

                    templateContext.addOrUpdateTemplate({
                      id: uniqueId,
                      name: finalLabel,
                      inCount: nextInCount,
                      outCount: nextOutCount,
                      nodes: draftNodes,
                      edges: draftEdges,
                    });
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
                    })
                  );

                  // Only remove connected edges if the number of exposed
                  // ports actually changed — otherwise preserve existing
                  // connections so users don't have to rewire on every save.
                  const countsChanged =
                    Number(nextInCount) !== Number(inCount) ||
                    Number(nextOutCount) !== Number(outCount);

                  if (countsChanged) {
                    setEdges((prev) =>
                      prev.filter(
                        (edge) =>
                          String(edge.source) !== String(id) &&
                          String(edge.target) !== String(id)
                      )
                    );
                  }

                  setIsEditorOpen(false);
                  setNameError(null);
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
});

SubflowNode.displayName = "SubflowNode";
