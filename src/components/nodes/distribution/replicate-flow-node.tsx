import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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
  useUpdateNodeInternals,
  Position,
} from "@xyflow/react";

import { BaseNode } from "@/components/base-node";
import { CustomTypedHandle } from "@/components/flow/custom-typed-handle";
import { Copy, Hand, MousePointer2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildDroppedNodeData,
  editorPaletteLabelByType,
  normalizeNodeTypeForEditor,
  projectClientToFlowPosition,
} from "@/flow/editor-node-factory";
import { getNodeDescription } from "@/flow/node-palette";
import { nodeTypesCore } from "@/flow/node-types-core";
import { computeOpenPortsFromLookup } from "@/flow/subflow-utils";
import { useSubcanvasNodeCreationLock } from "@/hooks/useSubcanvasNodeCreationLock";
import { useSubflowTemplateContext } from "@/flow/subflow-templates-context";
import { NestedSubflowNode } from "@/components/nodes/abstraction/nested-subflow-node";
import { MapInputValueNode } from "@/components/nodes/iteration/map-input-value-node";
import { useRemoteControllers } from "@/ws/remote-controllers-context";
import {
  connectMicrobitSlot,
  disconnectMicrobitSlot,
} from "@/microbit/use-microbit-slot";
import {
  microbitSlotManager,
  type MicrobitConnectionType,
} from "@/microbit/slot-manager";
import { ArrowConnectionLine } from "@/flow/arrow-connection-line";
import { deleteDraggedNodesOutsideViewport } from "@/flow/drag-delete";
import { useSharedEdgeConfig } from "@/hooks/useSharedEdgeConfig";
import { validateConnection } from "@/flow/connection-validation";
import { ConnectionErrorTooltip } from "@/flow/connection-error-tooltip";
import { useConnectionValidationTooltip } from "@/flow/use-connection-validation-tooltip";
import { reconcileWriteGraph } from "@/utils/flow";
import { NODE_TYPES } from "@/common/constants";
import {
  createConditionalPair,
  filterLockedEdgeChanges,
  handlePairedNodeChanges,
} from "@/utils/conditional-pair";
import { CanvasContextMenu } from "@/components/CanvasContextMenu";
import { useClipboardSelection } from "@/hooks/useClipboardSelection";
import { createNodeId } from "@/utils/id";
import type { FlowEdge, FlowNode } from "@/utils/flow";

export type ReplicateFlowNodeData = {
  label?: string;
  inCount?: number;
  outCount?: number;
  subflowNodes?: Node[];
  subflowEdges?: Edge[];
  remoteConnections?: ReplicateFlowRemoteConnection[];
  runtimeError?: string | null;
  isSelfCall?: boolean;
};

type ReplicateFlowExecutionTarget = "local" | "controller" | "microbit";

type ReplicateFlowRemoteConnection = {
  id: string;
  executionTarget: ReplicateFlowExecutionTarget;
  transport?: MicrobitConnectionType;
  controllerId?: string;
  controllerName?: string;
};

function sanitizeSlot(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(8, Math.floor(n)));
}

function parseReplicateFlowConnections(params: {
  rawRemoteConnections: ReplicateFlowNodeData["remoteConnections"];
}): ReplicateFlowRemoteConnection[] {
  const entries = Array.isArray(params.rawRemoteConnections)
    ? params.rawRemoteConnections
        .map((entry, index): ReplicateFlowRemoteConnection | null => {
          if (!entry || typeof entry !== "object") return null;
          const item = entry as Partial<ReplicateFlowRemoteConnection>;
          const executionTarget: ReplicateFlowExecutionTarget =
            item.executionTarget === "controller" ||
            item.executionTarget === "microbit"
              ? item.executionTarget
              : "local";
          const transport: MicrobitConnectionType =
            item.transport === "bluetooth" ? "bluetooth" : "serial";
          const idValue =
            typeof item.id === "string" && item.id.trim().length > 0
              ? item.id.trim()
              : `conn-${index + 1}`;
          return {
            id: idValue,
            executionTarget,
            transport,
            controllerId:
              typeof item.controllerId === "string"
                ? item.controllerId
                : undefined,
            controllerName:
              typeof item.controllerName === "string"
                ? item.controllerName
                : undefined,
          };
        })
        .filter((value): value is ReplicateFlowRemoteConnection =>
          Boolean(value),
        )
    : [];

  if (entries.length > 0) {
    return entries;
  }

  return [
    {
      id: "conn-1",
      executionTarget: "local",
      transport: "serial",
    },
  ];
}

type ReplicateFlowRfNode = Node<ReplicateFlowNodeData>;
const REPLICATE_INPUT_NODE_ID = "replicate-input-value";
const REPLICATE_OUTPUT_NODE_ID = "replicate-output-value";

function isReplicateInputNodeType(type: unknown): boolean {
  const safe = String(type ?? "");
  return (
    safe === NODE_TYPES.REPLICATE_INPUT_VALUE ||
    safe === NODE_TYPES.MAP_INPUT_VALUE
  );
}

function normalizeReplicateInputNodes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    if (!isReplicateInputNodeType(node.type)) return node;
    return {
      ...node,
      type: NODE_TYPES.REPLICATE_INPUT_VALUE,
    };
  });
}

function ensureReplicateBoundaryNodes(nodes: Node[]): Node[] {
  const list = Array.isArray(nodes) ? nodes : [];
  const filtered = list.filter(
    (node) =>
      String(node.type) !== "subflowInput" &&
      !(
        String(node.type) === "subflowOutput" &&
        node.id !== REPLICATE_OUTPUT_NODE_ID
      ),
  );

  const existingOutput =
    filtered.find((node) => String(node.id) === REPLICATE_OUTPUT_NODE_ID) ??
    list.find((node) => String(node.type) === "subflowOutput");

  const mandatoryOutput: Node = existingOutput
    ? {
        ...existingOutput,
        id: REPLICATE_OUTPUT_NODE_ID,
        type: "subflowOutput",
      }
    : {
        id: REPLICATE_OUTPUT_NODE_ID,
        type: "subflowOutput",
        position: { x: 260, y: 0 },
        data: { label: "Salida" },
        selected: false,
      };

  const rest = filtered.filter(
    (node) => String(node.id) !== String(mandatoryOutput.id),
  );

  return [mandatoryOutput, ...rest];
}

function filterEdgesByNodeIds(edges: Edge[], nodes: Node[]): Edge[] {
  const nodeIds = new Set(nodes.map((node) => String(node.id)));
  return edges.filter(
    (edge) =>
      nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target)),
  );
}

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
    const updateNodeInternals = useUpdateNodeInternals();
    const templateContext = useSubflowTemplateContext();
    const controllers = useRemoteControllers();
    const targetSelectId = useId();

    const {
      label = "Replicar flujo",
      subflowNodes,
      subflowEdges,
      remoteConnections: rawRemoteConnections,
      runtimeError,
      isSelfCall = false,
    } = (data ?? {}) as ReplicateFlowNodeData;

    const parsedConnections = parseReplicateFlowConnections({
      rawRemoteConnections,
    });

    const innerInputNode = (subflowNodes ?? []).find((node) =>
      isReplicateInputNodeType(node.type),
    );
    const hasInternalInput = !!innerInputNode;

    const connectionCount = Math.max(1, parsedConnections.length);
    const inOffsets = offsets(hasInternalInput ? connectionCount : 0);
    const outOffsets = offsets(connectionCount);

    const connectionSubtitle = (() => {
      const count = parsedConnections.length;
      return count === 1 ? "1 conexión" : `${count} conexiones`;
    })();

    const handleAddPort = useCallback(() => {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== id) return node;
          const currentData = (node.data ?? {}) as ReplicateFlowNodeData;
          const currentConns = parseReplicateFlowConnections({
            rawRemoteConnections: currentData.remoteConnections,
          });
          const nextId = `conn-${Date.now()}-${currentConns.length + 1}`;
          const nextConns: ReplicateFlowRemoteConnection[] = [
            ...currentConns,
            {
              id: nextId,
              executionTarget: "local",
              transport: "serial",
            },
          ];
          return {
            ...node,
            data: {
              ...currentData,
              remoteConnections: nextConns,
            },
          };
        }),
      );
    }, [id, setNodes]);

    const handleRemovePort = useCallback(() => {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== id) return node;
          const currentData = (node.data ?? {}) as ReplicateFlowNodeData;
          const currentConns = parseReplicateFlowConnections({
            rawRemoteConnections: currentData.remoteConnections,
          });
          if (currentConns.length <= 1) return node;
          const nextConns = currentConns.slice(0, -1);
          return {
            ...node,
            data: {
              ...currentData,
              remoteConnections: nextConns,
            },
          };
        }),
      );
    }, [id, setNodes]);

    useEffect(() => {
      const timer = window.setTimeout(() => {
        updateNodeInternals(id);
      }, 0);

      return () => {
        window.clearTimeout(timer);
      };
    }, [id, connectionCount, hasInternalInput, updateNodeInternals]);

    const [isEditorOpen, setIsEditorOpen] = useState(false);
    useSubcanvasNodeCreationLock(isEditorOpen);
    const [contextPoint, setContextPoint] = useState<{ x: number; y: number } | null>(null);
    const [isConnectionDialogOpen, setIsConnectionDialogOpen] = useState(false);
    const [connectingMicrobitConnectionId, setConnectingMicrobitConnectionId] =
      useState<string | null>(null);
    const [microbitConnectionError, setMicrobitConnectionError] = useState<
      string | null
    >(null);
    const [microbitConnectionTick, setMicrobitConnectionTick] = useState(0);
    const [connectionDraft, setConnectionDraft] = useState<
      ReplicateFlowRemoteConnection[]
    >(() => parsedConnections);
    const [editorCanvasMode, setEditorCanvasMode] = useState<"pan" | "select">(
      "pan",
    );
    const [draftNodes, setDraftNodes] = useState<Node[]>(() =>
      ensureReplicateBoundaryNodes(
        normalizeReplicateInputNodes(subflowNodes ?? []),
      ),
    );
    const [draftEdges, setDraftEdges] = useState<Edge[]>(() =>
      filterEdgesByNodeIds(
        subflowEdges ?? [],
        ensureReplicateBoundaryNodes(
          normalizeReplicateInputNodes(subflowNodes ?? []),
        ),
      ),
    );
    const [draftLabel, setDraftLabel] = useState(label);
    const [nameError] = useState<string | null>(null);

    const hasDraftInternalInput = useMemo(
      () =>
        !!(draftNodes ?? []).find((node) =>
          isReplicateInputNodeType(node.type),
        ),
      [draftNodes],
    );

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
            prev
              .filter(
                (n) =>
                  n.selected &&
                  String(n.id) !== REPLICATE_INPUT_NODE_ID &&
                  String(n.id) !== REPLICATE_OUTPUT_NODE_ID,
              )
              .map((n) => n.id),
          );
          const nextNodes = ensureReplicateBoundaryNodes(
            prev.filter(
              (n) => !n.selected || String(n.id) === REPLICATE_OUTPUT_NODE_ID,
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

    const editorLookupRef = useRef<unknown>(null);

    const onEditorNodesChange = useCallback(
      (changes: NodeChange[]) => {
        const removingMandatoryBoundary = changes.some(
          (change) =>
            change.type === "remove" &&
            "id" in change &&
            change.id === REPLICATE_OUTPUT_NODE_ID,
        );

        setDraftNodes((snapshot) => {
          const { nextNodes, nextEdges } = handlePairedNodeChanges({
            changes,
            nodes: snapshot,
            edges: draftEdges,
          });
          setDraftEdges(nextEdges);

          const normalized = ensureReplicateBoundaryNodes(nextNodes);
          if (removingMandatoryBoundary) {
            return normalized.map((node) =>
              String(node.id) === REPLICATE_OUTPUT_NODE_ID
                ? { ...node, selected: false }
                : node,
            );
          }

          return normalized;
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

    const [editorReactFlowInstance, setEditorReactFlowInstance] =
      useState<ReactFlowInstance | null>(null);

    const { copySelection, pasteSelection, onPaneMouseMove } =
      useClipboardSelection({
        nodes: draftNodes as FlowNode[],
        edges: draftEdges as FlowEdge[],
        setNodes: setDraftNodes as React.Dispatch<React.SetStateAction<FlowNode[]>>,
        setEdges: setDraftEdges as React.Dispatch<React.SetStateAction<FlowEdge[]>>,
        reactFlowInstance: editorReactFlowInstance,
      });

    const addCommentAtContext = useCallback(() => {
      if (!contextPoint) return;

      const instance = editorReactFlowInstance as
        | (ReactFlowInstance & {
            screenToFlowPosition?: (pos: { x: number; y: number }) => {
              x: number;
              y: number;
            };
            project?: (pos: { x: number; y: number }) => { x: number; y: number };
          })
        | null;

      const screenPos = { x: contextPoint.x, y: contextPoint.y };
      const position =
        instance?.screenToFlowPosition?.(screenPos) ??
        instance?.project?.(screenPos) ?? { x: 0, y: 0 };

      setDraftNodes((prev) => [
        ...prev,
        {
          id: createNodeId(),
          type: "comment",
          position,
          data: { text: "" },
        } as Node,
      ]);

      setContextPoint(null);
    }, [contextPoint, editorReactFlowInstance]);

    useEffect(() => {
      if (!isEditorOpen) return;

      const handler = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        const isTextInput =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);

        if (isTextInput) return;

        const key = e.key.toLowerCase();
        const hasCtrlOrMeta = e.ctrlKey || e.metaKey;

        if (hasCtrlOrMeta && key === "c") {
          e.preventDefault();
          e.stopImmediatePropagation();
          copySelection();
          return;
        }

        if (hasCtrlOrMeta && key === "v") {
          e.preventDefault();
          e.stopImmediatePropagation();
          pasteSelection();
        }
      };

      window.addEventListener("keydown", handler, { capture: true });
      return () =>
        window.removeEventListener("keydown", handler, { capture: true });
    }, [copySelection, isEditorOpen, pasteSelection]);

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
        });

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
          data,
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

    const onEditorNodeDragStop = useCallback<OnNodeDrag<Node>>(
      (event, node, draggedNodes) => {
        const nodesToEvaluate =
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
      },
      [editorFlowId],
    );

    const updateDraftConnection = (
      connectionId: string,
      patch: Partial<ReplicateFlowRemoteConnection>,
    ) => {
      setConnectionDraft((prev) =>
        prev.map((entry) =>
          entry.id === connectionId ? { ...entry, ...patch } : entry,
        ),
      );
    };

    const addConnection = () => {
      setConnectionDraft((prev) => {
        const nextId = `conn-${Date.now()}-${prev.length + 1}`;
        return [
          ...prev,
          {
            id: nextId,
            executionTarget: "local" as const,
            transport: "serial" as const,
          },
        ];
      });
    };

    const removeConnection = (connectionId: string) => {
      setConnectionDraft((prev) => {
        if (prev.length <= 1) return prev;
        return prev.filter((entry) => entry.id !== connectionId);
      });
    };

    const saveConnections = () => {
      const safeEntries =
        connectionDraft.length > 0
          ? connectionDraft
          : [
              {
                id: "conn-1",
                executionTarget: "local" as const,
                transport: "serial" as const,
              },
            ];

      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== id) return node;

          return {
            ...node,
            data: {
              ...(node.data ?? {}),
              remoteConnections: safeEntries,
              activeConnectionId: undefined,
              executionTarget: undefined,
              transport: undefined,
              controllerId: undefined,
              controllerName: undefined,
            },
          };
        }),
      );

      setIsConnectionDialogOpen(false);
    };

    const connectMicrobitFromDialog = async (
      connectionId: string,
      slot: number,
      connectionType: MicrobitConnectionType,
    ) => {
      setConnectingMicrobitConnectionId(connectionId);
      setMicrobitConnectionError(null);
      try {
        await connectMicrobitSlot({
          slot: sanitizeSlot(slot),
          connectionType,
        });
        setMicrobitConnectionTick((prev) => prev + 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setMicrobitConnectionError(message);
      } finally {
        setConnectingMicrobitConnectionId(null);
      }
    };

    const disconnectMicrobitFromDialog = async (
      connectionId: string,
      slot: number,
    ) => {
      setConnectingMicrobitConnectionId(connectionId);
      setMicrobitConnectionError(null);
      try {
        await disconnectMicrobitSlot({ slot: sanitizeSlot(slot) });
        setMicrobitConnectionTick((prev) => prev + 1);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setMicrobitConnectionError(message);
      } finally {
        setConnectingMicrobitConnectionId(null);
      }
    };

    const addInputValueNode = () => {
      setDraftNodes((prev) => {
        const existingInput = prev.find((node) =>
          isReplicateInputNodeType(node.type),
        );
        if (existingInput) {
          return prev.map((node) => ({
            ...node,
            slot: sanitizeSlot(prev.length + 1),
            selected: String(node.id) === String(existingInput.id),
          }));
        }

        const outputNode = prev.find(
          (node) => String(node.id) === REPLICATE_OUTPUT_NODE_ID,
        );

        const candidateId = prev.some(
          (node) => String(node.id) === REPLICATE_INPUT_NODE_ID,
        )
          ? createInnerNodeId()
          : REPLICATE_INPUT_NODE_ID;

        const HORIZONTAL_OFFSET = 160;
        const VERTICAL_OFFSET = 40;

        const newNode: Node = {
          id: candidateId,
          type: NODE_TYPES.REPLICATE_INPUT_VALUE,
          position: {
            x:
              typeof outputNode?.position?.x === "number"
                ? outputNode.position.x - HORIZONTAL_OFFSET
                : 0,
            y:
              typeof outputNode?.position?.y === "number"
                ? outputNode.position.y + VERTICAL_OFFSET
                : 120,
          },
          data: { label: "Lista de entrada" },
          selected: true,
        };

        return [...prev.map((node) => ({ ...node, selected: false })), newNode];
      });
    };

    return (
      <BaseNode
        runtimeError={runtimeError}
        infoDescription={getNodeDescription("replicateFlow") ?? undefined}
        className="relative flex w-36 flex-col items-center justify-center rounded-none border-yellow-600 bg-yellow-500 px-3 py-2 text-center text-white shadow-md z-10"
        sideActionsClassName="top-auto -bottom-8 left-1/2 -translate-x-1/2 translate-y-0 flex flex-row items-center justify-center gap-2 w-auto h-auto bg-transparent backdrop-blur-none border-0 rounded-none shadow-none z-0"
        sideActions={
          !isSelfCall ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="node"
                    aria-label="Agregar conexión"
                    className="pointer-events-auto rounded-sm bg-transparent p-0 text-(--node-action-color)  transition-colors flex h-5 w-5 items-center justify-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleAddPort();
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  Agregar conexión
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="node"
                    aria-label="Eliminar conexión"
                    className="pointer-events-auto rounded-sm bg-transparent p-0 text-(--node-action-color) disabled:opacity-30 transition-colors flex h-5 w-5 items-center justify-center"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemovePort();
                    }}
                    disabled={connectionCount <= 1}
                  >
                    <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  Eliminar conexión
                </TooltipContent>
              </Tooltip>
            </>
          ) : undefined
        }
        onConfigClick={
          !isSelfCall
            ? () => {
                const normalizedNodes = ensureReplicateBoundaryNodes(
                  normalizeReplicateInputNodes(subflowNodes ?? []),
                );
                setDraftNodes(normalizedNodes);
                setDraftEdges(
                  filterEdgesByNodeIds(subflowEdges ?? [], normalizedNodes),
                );
                setDraftLabel(label);
                setIsEditorOpen(true);
              }
            : undefined
        }
        onConnectClick={
          !isSelfCall
            ? () => {
                setConnectionDraft(parsedConnections);
                setIsConnectionDialogOpen(true);
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
                const normalizedNodes = ensureReplicateBoundaryNodes(
                  normalizeReplicateInputNodes(subflowNodes ?? []),
                );
                setDraftNodes(normalizedNodes);
                setDraftEdges(
                  filterEdgesByNodeIds(subflowEdges ?? [], normalizedNodes),
                );
                setDraftLabel(label);
                setIsEditorOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  const normalizedNodes = ensureReplicateBoundaryNodes(
                    normalizeReplicateInputNodes(subflowNodes ?? []),
                  );
                  setDraftNodes(normalizedNodes);
                  setDraftEdges(
                    filterEdgesByNodeIds(subflowEdges ?? [], normalizedNodes),
                  );
                  setDraftLabel(label);
                  setIsEditorOpen(true);
                }
              }}
            >
              <Copy className="rotate-90" />
            </div>
          ) : (
            <div className="text-2xl font-bold leading-none">
              <Copy className="rotate-90" />
            </div>
          )}
          <div className="text-sm leading-tight">{label}</div>
          <div className="text-[10px] leading-tight text-white/90">
            {connectionSubtitle}
          </div>
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
              {!hasDraftInternalInput && (
                <div className="flex items-center justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addInputValueNode}
                  >
                    Agregar entrada
                  </Button>
                </div>
              )}
              {nameError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  {nameError}
                </div>
              )}

              <div className="h-[60vh] w-full overflow-hidden rounded-md border">
                <CanvasContextMenu
                  onContextMenu={(event: React.MouseEvent) => {
                    setContextPoint({ x: event.clientX, y: event.clientY });
                  }}
                  onAddComment={addCommentAtContext}
                  copySelection={copySelection}
                  pasteSelection={pasteSelection}
                >
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
                        mapInputValue: MapInputValueNode,
                        replicateInputValue: MapInputValueNode,
                      }}
                      onNodesChange={onEditorNodesChange}
                      onEdgesChange={onEditorEdgesChange}
                      onConnect={onEditorConnect}
                      isValidConnection={connectionTooltip.isValidConnection}
                      onConnectStart={connectionTooltip.onConnectStart}
                      onConnectEnd={connectionTooltip.onConnectEnd}
                      onInit={(instance) => {
                        editorInstanceRef.current = instance;
                        setEditorReactFlowInstance(
                          instance as unknown as ReactFlowInstance,
                        );
                      }}
                      onDrop={onEditorDrop}
                      onDragOver={onEditorDragOver}
                      onNodeDragStop={onEditorNodeDragStop}
                      onPaneMouseMove={onPaneMouseMove}
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
                </CanvasContextMenu>
              </div>

              <DialogFooter>
                <div className="flex items-center gap-2">
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
                      const normalizedNodes =
                        ensureReplicateBoundaryNodes(draftNodes);
                      const normalizedEdges = filterEdgesByNodeIds(
                        draftEdges,
                        normalizedNodes,
                      );
                      const hasMapInputValue = normalizedNodes.some((node) =>
                        isReplicateInputNodeType(node.type),
                      );
                      const nextInCount = hasMapInputValue ? 1 : 0;
                      let nextOutCount = 1;
                      try {
                        const computed = computeOpenPortsFromLookup(
                          normalizedNodes,
                          normalizedEdges,
                          lookup,
                        );
                        if (computed && computed.ready) {
                          nextOutCount = Math.min(1, computed.outCount);
                        }
                      } catch {
                        // ignore
                      }

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
                              subflowNodes: normalizedNodes,
                              subflowEdges: normalizedEdges,
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

        <Dialog
          open={isConnectionDialogOpen}
          onOpenChange={setIsConnectionDialogOpen}
        >
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Configurar conexiones remotas</DialogTitle>
              <DialogDescription>
                Agrega varias conexiones para este nodo. Todas se usarán en la
                ejecución.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {connectionDraft.map((entry, index) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-border bg-muted/20 p-3 space-y-3"
                >
                  {(() => {
                    const implicitSlot = sanitizeSlot(index + 1);
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium text-foreground">
                            Conexión {index + 1}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => removeConnection(entry.id)}
                              disabled={connectionDraft.length <= 1}
                            >
                              Quitar
                            </Button>
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor={`${targetSelectId}-${entry.id}`}
                            className="mb-1 block text-xs font-medium text-foreground"
                          >
                            Ejecutar en
                          </label>
                          <Select
                            value={entry.executionTarget}
                            onValueChange={(value) => {
                              if (
                                value !== "local" &&
                                value !== "controller" &&
                                value !== "microbit"
                              ) {
                                return;
                              }

                              updateDraftConnection(entry.id, {
                                executionTarget: value,
                                transport:
                                  value === "microbit"
                                    ? (entry.transport ?? "serial")
                                    : undefined,
                                controllerId:
                                  value === "controller"
                                    ? (entry.controllerId ?? undefined)
                                    : undefined,
                                controllerName:
                                  value === "controller"
                                    ? (entry.controllerName ?? undefined)
                                    : undefined,
                              });
                            }}
                          >
                            <SelectTrigger id={`${targetSelectId}-${entry.id}`}>
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="local">Esta PC</SelectItem>
                              <SelectItem value="controller">
                                Otra PC
                              </SelectItem>
                              <SelectItem value="microbit">
                                micro:bit
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {entry.executionTarget === "controller" && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-foreground">
                              PC remota
                            </label>
                            <Select
                              value={entry.controllerId || undefined}
                              onValueChange={(value) => {
                                if (value === "__none__") return;
                                const controller = controllers.find(
                                  (item) => item.id === value,
                                );
                                updateDraftConnection(entry.id, {
                                  controllerId: value,
                                  controllerName: controller?.name ?? undefined,
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona una PC" />
                              </SelectTrigger>
                              <SelectContent>
                                {controllers.length === 0 ? (
                                  <SelectItem value="__none__" disabled>
                                    (Sin PCs conectadas)
                                  </SelectItem>
                                ) : (
                                  controllers.map((controller) => (
                                    <SelectItem
                                      key={controller.id}
                                      value={controller.id}
                                    >
                                      {controller.name ?? controller.id}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {entry.executionTarget === "microbit" && (
                          <div>
                            <label className="mb-1 block text-xs font-medium text-foreground">
                              Método de conexión
                            </label>
                            <Select
                              value={entry.transport ?? "serial"}
                              onValueChange={(value) => {
                                if (
                                  value === "serial" ||
                                  value === "bluetooth"
                                ) {
                                  updateDraftConnection(entry.id, {
                                    transport: value,
                                  });
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="serial">
                                  Cable (Web Serial)
                                </SelectItem>
                                <SelectItem value="bluetooth">
                                  Bluetooth (Web Bluetooth)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="text-xs text-muted-foreground">
                                {(() => {
                                  void microbitConnectionTick;
                                  const slotState =
                                    microbitSlotManager.getSnapshot(
                                      implicitSlot,
                                    );
                                  if (slotState.status !== "connected") {
                                    return `micro:bit #${slotState.slot}: No conectado`;
                                  }
                                  const transportLabel =
                                    slotState.connectionType === "bluetooth"
                                      ? "Bluetooth"
                                      : "Serial";
                                  return `micro:bit #${slotState.slot}: Conectado (${transportLabel})`;
                                })()}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={
                                    connectingMicrobitConnectionId === entry.id
                                  }
                                  onClick={() =>
                                    void disconnectMicrobitFromDialog(
                                      entry.id,
                                      implicitSlot,
                                    )
                                  }
                                >
                                  Desconectar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={
                                    connectingMicrobitConnectionId === entry.id
                                  }
                                  onClick={() =>
                                    void connectMicrobitFromDialog(
                                      entry.id,
                                      implicitSlot,
                                      entry.transport ?? "serial",
                                    )
                                  }
                                >
                                  {connectingMicrobitConnectionId === entry.id
                                    ? "Conectando…"
                                    : "Conectar"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}
              {microbitConnectionError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  {microbitConnectionError}
                </div>
              )}
            </div>

            <DialogFooter>
              <div className="flex w-full items-center justify-between gap-2">
                <Button type="button" variant="outline" onClick={addConnection}>
                  Agregar conexión
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setIsConnectionDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="button" onClick={saveConnections}>
                    Guardar
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </BaseNode>
    );
  },
);

ReplicateFlowNode.displayName = "ReplicateFlowNode";
