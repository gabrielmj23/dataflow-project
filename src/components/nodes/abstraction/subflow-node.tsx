import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import type {
  Edge,
  Node,
  NodeProps,
  OnNodeDrag,
  OnConnectStartParams,
} from "@xyflow/react";
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
import {
  Hand,
  MousePointer2,
  PictureInPicture2,
  RefreshCw,
  Share2,
  Split,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { nodeTypesCore } from "@/flow/node-types-core";
import {
  computeDanglingPortsFromLookup,
  computeOpenPortsFromLookup,
} from "@/flow/subflow-utils";
import {
  buildDroppedNodeData,
  editorPaletteLabelByType,
  projectClientToFlowPosition,
} from "@/flow/editor-node-factory";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSubflowTemplateContext } from "@/flow/subflow-templates-context";
import { NestedSubflowNode } from "@/components/nodes/abstraction/nested-subflow-node";
import { ArrowConnectionLine } from "@/flow/arrow-connection-line";
import { deleteDraggedNodesOutsideViewport } from "@/flow/drag-delete";
import { useSharedEdgeConfig } from "@/hooks/useSharedEdgeConfig";
import { useSubcanvasNodeCreationLock } from "@/hooks/useSubcanvasNodeCreationLock";
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
import {
  createConditionalPair,
  filterLockedEdgeChanges,
  handlePairedNodeChanges,
} from "@/utils/conditional-pair";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";
import { type MicrobitTransport } from "@/microbit/connection-manager";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getStoredAuthToken, getStoredAuthUser } from "@/lib/auth";
import { ShareSubflowDialog } from "@/components/custom-nodes/ShareSubflowDialog";
import { createCustomNode } from "@/lib/custom-nodes";
import {
  addNodesToExtension,
  createExtension,
  fetchMyExtensions,
  type ExtensionListItem,
} from "@/lib/extensions";
import { buildProhibitedTermsError } from "@/lib/content-moderation";
import { toast } from "sonner";
import { getDarkerColor } from "@/utils/colors";
import { useQueryClient } from "@tanstack/react-query";
import { CanvasContextMenu } from "@/components/CanvasContextMenu";
import { useClipboardSelection } from "@/hooks/useClipboardSelection";
import { createNodeId } from "@/utils/id";
import type { FlowEdge, FlowNode } from "@/utils/flow";

export type SubflowNodeData = {
  label?: string;
  templateAuthorName?: string;
  accentColor?: string;
  inCount?: number;
  outCount?: number;
  subflowNodes?: Node[];
  subflowEdges?: Edge[];
  templateId?: string;
  isSelfCall?: boolean;
  executionTarget?: "local" | "controller" | "microbit";
  transport?: MicrobitTransport;
  controllerId?: string;
  controllerName?: string;
};

type SubflowRfNode = Node<SubflowNodeData>;

function EditorStoreBridge({
  onNodeLookup,
}: {
  onNodeLookup: (lookup: unknown) => void;
}) {
  const nodeLookup = useStore(
    (state) => (state as unknown as { nodeLookup: unknown }).nodeLookup,
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
  const queryClient = useQueryClient();

  const {
    label = "Subflujo",
    templateAuthorName: rawTemplateAuthorName,
    accentColor: rawAccentColor,
    inCount: rawInCount,
    outCount: rawOutCount,
    subflowNodes,
    subflowEdges,
    templateId,
    isSelfCall = false,
    executionTarget: rawExecutionTarget,
    transport: rawTransport,
    controllerId: rawControllerId,
    controllerName: rawControllerName,
  } = (data ?? {}) as SubflowNodeData;

  const inCount = Number.isFinite(rawInCount) ? (rawInCount as number) : 0;
  const outCount = Number.isFinite(rawOutCount) ? (rawOutCount as number) : 0;

  const inOffsets = offsets(inCount);
  const outOffsets = offsets(outCount);
  const executionTarget =
    rawExecutionTarget === "controller"
      ? "controller"
      : rawExecutionTarget === "microbit"
        ? "microbit"
        : "local";
  const transport: MicrobitTransport =
    rawTransport === "bluetooth" || rawTransport === "serial"
      ? rawTransport
      : "serial";
  const controllerId =
    typeof rawControllerId === "string" ? rawControllerId : "";
  const controllerName =
    typeof rawControllerName === "string" ? rawControllerName : "";
  const resolvedTemplate =
    templateContext && templateId
      ? templateContext.resolveTemplate(templateId)
      : templateContext
        ? templateContext.resolveTemplateByName(label)
        : null;
  const templateAuthorName =
    typeof rawTemplateAuthorName === "string" && rawTemplateAuthorName.trim()
      ? rawTemplateAuthorName.trim()
      : typeof resolvedTemplate?.authorName === "string" &&
          resolvedTemplate.authorName.trim()
        ? resolvedTemplate.authorName.trim()
        : "";

  const accentColor = rawAccentColor || resolvedTemplate?.accentColor;
  const darkerBorder = useMemo(
    () => (accentColor ? getDarkerColor(accentColor, 25) : undefined),
    [accentColor],
  );

  // Extract explicit `subflowInput` nodes (created in the editor) and
  // order them top-to-bottom so they map to the left handles deterministically.
  const explicitInputNodes = (() => {
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
  })();

  const selfTemplateId =
    typeof templateId === "string" && templateId.trim().length > 0
      ? templateId.trim()
      : String(id);

  // Ensure XYFlow recomputes handle bounds whenever the number of ports changes.
  const explicitInputCount = explicitInputNodes.length;
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, inCount, outCount, explicitInputCount, updateNodeInternals]);

  const minHeight = (() => {
    const base = 64; // a bit taller base than before
    const perInput = 18; // extra height per input
    const count =
      Number.isFinite(Number(explicitInputCount)) && explicitInputCount > 0
        ? explicitInputCount
        : inCount;
    return base + Math.max(0, count - 1) * perInput;
  })();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  useSubcanvasNodeCreationLock(isEditorOpen);
  const [contextPoint, setContextPoint] = useState<{ x: number; y: number } | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isShareSubmitting, setIsShareSubmitting] = useState(false);
  const [shareSubmitError, setShareSubmitError] = useState<string | null>(null);
  const [myExtensions, setMyExtensions] = useState<ExtensionListItem[]>([]);
  const [selectedExtensionIds, setSelectedExtensionIds] = useState<string[]>(
    [],
  );
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
  const [addToPalette, setAddToPalette] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar ejecucion",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  const explicitInputCountDraft = useMemo(
    () => draftNodes.filter((n) => String(n.type) === "subflowInput").length,
    [draftNodes],
  );

  const explicitOutputCountDraft = useMemo(
    () => draftNodes.filter((n) => String(n.type) === "subflowOutput").length,
    [draftNodes],
  );

  const desiredSelfCallInCount =
    explicitInputCountDraft > 0 ? explicitInputCountDraft : inCount;
  const desiredSelfCallOutCount =
    explicitOutputCountDraft > 0 ? 1 : Math.max(0, outCount);

  const baseLabel = label;

  const reconciled = reconcileWriteGraph(draftNodes, draftEdges);
  const effectiveDraftNodes = reconciled.changedNodes
    ? (reconciled.nodes as Node[])
    : draftNodes;
  const effectiveDraftEdges = reconciled.changedEdges
    ? (reconciled.edges as Edge[])
    : draftEdges;

  const syncedDraftNodes = (() => {
    if (!selfTemplateId) return effectiveDraftNodes;
    const nextLabel = (draftLabel || baseLabel).trim() || baseLabel;

    return effectiveDraftNodes.map((node) => {
      if (node.type !== "subflow") return node;
      const nodeData = (node.data ?? {}) as SubflowNodeData;
      if (!nodeData.isSelfCall) return node;
      const nodeTemplateId =
        typeof nodeData.templateId === "string"
          ? nodeData.templateId.trim()
          : null;
      if (nodeTemplateId !== selfTemplateId) return node;

      const currentIn = Number.isFinite(nodeData.inCount)
        ? (nodeData.inCount as number)
        : 0;
      const currentOut = Number.isFinite(nodeData.outCount)
        ? (nodeData.outCount as number)
        : 0;
      const needsLabel = (nodeData.label ?? nextLabel) !== nextLabel;
      const needsInUpdate = currentIn !== desiredSelfCallInCount;
      const needsOutUpdate = currentOut !== desiredSelfCallOutCount;
      if (!needsLabel && !needsInUpdate && !needsOutUpdate) {
        return node;
      }

      return {
        ...node,
        data: {
          ...(node.data ?? {}),
          label: nextLabel,
          inCount: desiredSelfCallInCount,
          outCount: desiredSelfCallOutCount,
        },
      };
    });
  })();
  const connectionTooltip = useConnectionValidationTooltip(syncedDraftNodes);
  const [connectionHighlight, setConnectionHighlight] =
    useState<ConnectionHighlightState>(null);
  const isAuthenticated = Boolean(getStoredAuthUser() && getStoredAuthToken());

  useEffect(() => {
    if (!isShareDialogOpen || !isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadMyExtensions = async () => {
      try {
        const extensions = await fetchMyExtensions();
        if (cancelled) return;
        setMyExtensions(extensions);
      } catch (error) {
        if (cancelled) return;
        console.error("No se pudieron cargar tus extensiones.", error);
      } finally {
        // no-op
      }
    };

    loadMyExtensions();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isShareDialogOpen]);

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

  const onDraftInputLabelChange = useCallback(
    (nodeId: string, nextLabel: string) => {
      setDraftNodes((prev) =>
        prev.map((node) => {
          if (String(node.id) !== nodeId) {
            return node;
          }
          return {
            ...node,
            data: {
              ...(node.data ?? {}),
              label: nextLabel,
            },
          };
        }),
      );
    },
    [],
  );

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
      const validation = validateConnection(syncedDraftNodes, connection);
      if (!validation.ok) {
        connectionTooltip.show(validation.message ?? "Conexión no válida.");
        return;
      }
      setDraftEdges((snapshot) => addEdge(connection, snapshot));
    },
    [connectionTooltip, syncedDraftNodes],
  );
  const sharedEdgeConfig = useSharedEdgeConfig<Edge>(setDraftEdges);

  const onEditorConnectStart = useCallback(
    (event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      connectionTooltip.onConnectStart(event, params);

      if (!params.nodeId || params.handleType !== "source") {
        setConnectionHighlight(null);
        return;
      }

      const sourceNode = syncedDraftNodes.find(
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
    [connectionTooltip, syncedDraftNodes],
  );

  const onEditorConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      connectionTooltip.onConnectEnd(event);
      setConnectionHighlight(null);
    },
    [connectionTooltip],
  );

  const editorFlowId = useMemo(() => `subflow-editor-${id}`, [id]);

  // Ensure draft nodes use canonical type keys that exist in `nodeTypesCore`.
  const normalizeNodeType = useCallback((t: unknown): string | undefined => {
    if (!t) return undefined;
    const s = String(t);
    const nodeTypesLookup = nodeTypesCore as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(nodeTypesLookup, s)) return s;
    const lower = s.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(nodeTypesLookup, lower))
      return lower;
    return s;
  }, []);

  const paletteLabelByType = editorPaletteLabelByType;

  const [editorReactFlowInstance, setEditorReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const { copySelection, pasteSelection, onPaneMouseMove } =
    useClipboardSelection({
      nodes: syncedDraftNodes as FlowNode[],
      edges: effectiveDraftEdges as FlowEdge[],
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
    // Generate a new id and ensure it does not collide with existing draft nodes.
    // This can happen when the editor is opened with nodes that already contain
    // generated ids; we advance the counter until we find a unique id.
    const existing = new Set<string>([
      ...(draftNodes ?? []).map((n) => String(n.id)),
      ...(draftEdges ?? []).map((e) => String(e.id)),
    ]);
    let next = nextInnerIdRef.current++;
    let candidate = `inner-${id}-${next}`;
    while (existing.has(candidate)) {
      next = nextInnerIdRef.current++;
      candidate = `inner-${id}-${next}`;
    }
    return candidate;
  }, [draftNodes, draftEdges, id]);

  const insertSelfInstance = () => {
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

    const position = instance?.project?.({ x: 200, y: 200 }) ?? {
      x: 200,
      y: 200,
    };

    const nextLabel =
      (draftLabel || resolvedFromTemplate?.name || label).trim() || label;

    // Determine desired exposed port counts for the self-call instance.
    // Use explicit `subflowInput` nodes count (added via editor) for inputs,
    // falling back to the node's current `inCount`/`outCount` when unknown.
    const desiredIn = desiredSelfCallInCount;
    const desiredOut = desiredSelfCallOutCount;

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
  };

  const onEditorDragOver = useCallback((event: DragEvent) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onEditorDrop = (event: DragEvent) => {
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
  };

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

  return (
    <>
      <BaseNode
        className={cn(
          "relative flex w-52 flex-col items-center justify-center rounded-xl px-3 py-2 text-center text-white shadow-md",
          !accentColor && "border-violet-700 bg-violet-500",
        )}
        style={{
          minHeight: `${minHeight}px`,
          backgroundColor: accentColor,
          borderColor: darkerBorder,
          backgroundImage: accentColor
            ? `linear-gradient(135deg, ${accentColor} 0%, ${darkerBorder} 100%)`
            : undefined,
        }}
        onConfigClick={
          !isSelfCall
            ? () => {
                setDraftNodes(subflowNodes ?? []);
                setDraftEdges(subflowEdges ?? []);
                setDraftLabel(label);
                setAddToPalette(false);
                setNameError(null);
                setIsEditorOpen(true);
              }
            : undefined
        }
        onConnectClick={!isSelfCall ? config.onConfigClick : undefined}
        topActions={
          !isSelfCall && isAuthenticated ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-node"
                  variant="node"
                  aria-label="Compartir"
                  className="pointer-events-auto opacity-100 bg-transparent shadow-none p-1 text-(--node-action-color)"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsShareDialogOpen(true);
                  }}
                >
                  <Share2 className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                Compartir
              </TooltipContent>
            </Tooltip>
          ) : null
        }
      >
        {(() => {
          const hasInputs = explicitInputNodes.length > 0 || inCount > 0;
          return (
            <div
              className={`flex flex-col gap-0.5 items-center ${hasInputs ? "ml-15" : ""}`}
              style={{
                textShadow: accentColor
                  ? `0 1px 2px ${darkerBorder}88`
                  : undefined,
              }}
            >
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
                    setAddToPalette(false);
                    setNameError(null);
                    setIsEditorOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      setDraftNodes(subflowNodes ?? []);
                      setDraftEdges(subflowEdges ?? []);
                      setDraftLabel(label);
                      setAddToPalette(false);
                      setNameError(null);
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
              {config.subtitle && (
                <div className="text-xs leading-tight text-white/85">
                  {config.subtitle}
                </div>
              )}
            </div>
          );
        })()}

        {inOffsets.map((offset, index) => (
          <CustomTypedHandle
            key={`l-${offset}`}
            type="target"
            position={Position.Left}
            id={`in-${index + 1}`}
            dataType="any"
            className="h-2 w-2 -translate-y-1/2"
            indicatorClassName={cn(
              "border-violet-700",
              accentColor && "border-[--indicator-border]",
            )}
            style={{
              top: offset,
              // @ts-expect-error custom css variable
              "--indicator-border": darkerBorder,
            }}
          />
        ))}

        {/* Render input labels aligned with left handles (editable) */}
        {inOffsets.map((offset, index) => {
          const inputNode = explicitInputNodes[index];
          const inputLabel = inputNode
            ? (() => {
                const data = (inputNode.data ?? {}) as Record<string, unknown>;
                return typeof data.label === "string"
                  ? data.label
                  : `Entrada ${index + 1}`;
              })()
            : `Entrada ${index + 1}`;
          const label = String(inputLabel);
          const trimmed = String(label ?? "").trim();
          const len = Math.max(0, trimmed.length);
          const widthPx = len <= 1 ? 44 : Math.min(160, 24 + len * 9);

          return (
            <Input
              key={`in-label-${index}`}
              value={label}
              readOnly
              tabIndex={-1}
              className="nodrag absolute h-6 -translate-y-1/2 border-0 bg-transparent px-1.5 text-left text-[10px] text-white placeholder:text-white/60 focus:outline-none pointer-events-none shadow-none"
              style={{
                top: `calc(${offset} + 9px)`,
                left: "12px",
                width: `${widthPx}px`,
                transform: "translate(0, -50%)",
                textShadow: accentColor
                  ? `0 1px 1px ${darkerBorder}aa`
                  : undefined,
              }}
            />
          );
        })}

        {outOffsets.map((offset, index) => (
          <CustomTypedHandle
            key={`r-${offset}`}
            type="source"
            position={Position.Right}
            style={{
              top: offset,
              // @ts-expect-error custom css variable
              "--indicator-border": darkerBorder,
            }}
            id={`out-${index + 1}`}
            dataType="any"
            className="h-2 w-2 -translate-y-1/2"
            indicatorClassName={cn(
              "border-violet-700",
              accentColor && "border-[--indicator-border]",
            )}
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
              <DialogTitle>
                Editar subflujo{" "}
                {templateAuthorName ? (
                  <span className="bg-violet-100 text-violet-600 rounded-xl px-2 py-0.5 w-fit text-sm font-medium ms-1">
                    Autor: {templateAuthorName}
                  </span>
                ) : null}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 overflow-y-auto max-h-[80vh]">
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

                    // Compute center of the editor container and project to flow coords.
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
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const instance = editorInstanceRef.current as
                      | (ReactFlowInstance & {
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
                    const labelText = "Salida";
                    const outputNode: Node = {
                      id: outputId,
                      type: "subflowOutput",
                      position,
                      data: { label: labelText },
                    };
                    setDraftNodes((prev) => [...prev, outputNode]);
                  }}
                >
                  <Split className="mr-1 h-4 w-4" />
                  Añadir salida
                </Button>
                {!templateId ? (
                  <span className="text-xs text-muted-foreground">
                    Se insertará la definición actual (no guardada).
                  </span>
                ) : null}
              </div>

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
                    <ConnectionHighlightProvider value={connectionHighlight}>
                      <ReactFlow
                        id={editorFlowId}
                        nodes={syncedDraftNodes.map((n) => ({
                          ...n,
                          type: normalizeNodeType(n.type),
                          data:
                            String(n.type) === "subflowInput"
                              ? {
                                  ...(n.data ?? {}),
                                  onLabelChange: (nextLabel: string) =>
                                    onDraftInputLabelChange(
                                      String(n.id),
                                      nextLabel,
                                    ),
                                }
                              : n.data,
                        }))}
                        edges={effectiveDraftEdges}
                        {...sharedEdgeConfig}
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
                    </ConnectionHighlightProvider>
                  </ReactFlowProvider>
                </CanvasContextMenu>
              </div>
            </div>
            <DialogFooter>
              <div className="flex items-center gap-2">
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
                    const explicitInputs = syncedDraftNodes.filter(
                      (n) => String(n.type) === "subflowInput",
                    ).length;
                    const nextInCount = Number.isFinite(Number(explicitInputs))
                      ? explicitInputs
                      : Number.isFinite(rawInCount)
                        ? (rawInCount as number)
                        : inCount;

                    // If there are explicit subflowOutput nodes, expose exactly one salida.
                    const explicitOutputs = syncedDraftNodes.filter(
                      (n) => String(n.type) === "subflowOutput",
                    ).length;

                    // For outputs keep the previous behavior (try to compute open ports)
                    // when no explicit subflowOutput nodes exist.
                    const lookup = editorLookupRef.current;
                    let nextOutCount =
                      explicitOutputs > 0
                        ? 1
                        : Number.isFinite(rawOutCount)
                          ? (rawOutCount as number)
                          : outCount;
                    try {
                      const computed = computeOpenPortsFromLookup(
                        syncedDraftNodes,
                        effectiveDraftEdges,
                        lookup,
                      );
                      if (computed && computed.ready && explicitOutputs === 0) {
                        nextOutCount = computed.outCount;
                      }
                    } catch {
                      // ignore
                    }

                    try {
                      const dangling = computeDanglingPortsFromLookup(
                        syncedDraftNodes,
                        effectiveDraftEdges,
                        lookup,
                      );
                      const hasDanglingPorts =
                        dangling.ready &&
                        (dangling.inCount > 0 || dangling.outCount > 0);
                      if (hasDanglingPorts) {
                        setNameError(
                          `Hay nodos con entradas/salidas abiertas (${dangling.inCount} entrada(s), ${dangling.outCount} salida(s)). Conecta todos los puertos antes de guardar.`,
                        );
                        return;
                      }
                    } catch {
                      // ignore
                    }

                    const finalLabel = (draftLabel || label).trim() || label;
                    // Prevent saving if any subflow input labels are empty
                    const hasEmptyInputs = syncedDraftNodes.some((n) => {
                      if (String(n.type) !== "subflowInput") return false;
                      const data = (n.data ?? {}) as Record<string, unknown>;
                      const label =
                        typeof data.label === "string" ? data.label : "";
                      return !label.trim();
                    });
                    if (hasEmptyInputs) {
                      setNameError(
                        "Hay entradas sin nombre. Escribe un nombre en todas las entradas antes de guardar.",
                      );
                      return;
                    }

                    // Prevent saving if there are more than one exposed outputs
                    if (Number(nextOutCount) > 1) {
                      setNameError(
                        "El subflujo no puede exponer más de 1 salida. Cierra salidas antes de guardar.",
                      );
                      return;
                    }

                    // Validación externa (ej. nivel 4: recursión de cola obligatoria).
                    if (templateContext?.onValidateSubflowEdit) {
                      const validationError =
                        templateContext.onValidateSubflowEdit(
                          templateId,
                          syncedDraftNodes as Node[],
                          effectiveDraftEdges,
                        );
                      if (validationError) {
                        setNameError(validationError);
                        return;
                      }
                    }

                    if (addToPalette && templateContext) {
                      if (templateContext.isNameTaken(finalLabel)) {
                        setNameError(
                          "Ya existe un subflujo en la paleta con ese nombre. Elige otro nombre.",
                        );
                        return;
                      }

                      const baseId = templateId || `sf-node-${String(id)}`;
                      const uniqueId = `${baseId}-${Date.now().toString(36)}`;

                      // When saving to the palette, rebind self-call nodes to the new template id
                      // so dragging from the palette can resolve the template correctly.
                      const paletteNodes = syncedDraftNodes.map((n) => {
                        if (n.type !== "subflow") return n;
                        const data = (n.data ?? {}) as SubflowNodeData;
                        const nodeTemplateId =
                          typeof data.templateId === "string" &&
                          data.templateId.trim().length > 0
                            ? data.templateId.trim()
                            : null;
                        const isSelf = data.isSelfCall === true;
                        if (
                          isSelf &&
                          (!nodeTemplateId ||
                            nodeTemplateId === selfTemplateId ||
                            nodeTemplateId === templateId)
                        ) {
                          return {
                            ...n,
                            data: {
                              ...data,
                              templateId: uniqueId,
                            },
                          };
                        }
                        return n;
                      });

                      templateContext.addOrUpdateTemplate({
                        id: uniqueId,
                        name: finalLabel,
                        inCount: nextInCount,
                        outCount: nextOutCount,
                        nodes: paletteNodes,
                        edges: effectiveDraftEdges,
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
                            subflowNodes: syncedDraftNodes,
                            subflowEdges: effectiveDraftEdges,
                            inCount: nextInCount,
                            outCount: nextOutCount,
                          },
                        };
                      }),
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
                            String(edge.target) !== String(id),
                        ),
                      );
                    }

                    setIsEditorOpen(false);
                    setNameError(null);
                  }}
                >
                  Guardar
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </BaseNode>
      <ShareSubflowDialog
        key={`${id}-${label}`}
        open={isShareDialogOpen}
        onOpenChange={(open) => {
          setIsShareDialogOpen(open);
          if (!open) {
            setShareSubmitError(null);
            setIsShareSubmitting(false);
            setSelectedExtensionIds([]);
          }
        }}
        subflowName={label}
        availableExtensions={myExtensions}
        selectedExtensionIds={selectedExtensionIds}
        onToggleExtension={(extensionId) => {
          setSelectedExtensionIds((prev) =>
            prev.includes(extensionId)
              ? prev.filter((idValue) => idValue !== extensionId)
              : [...prev, extensionId],
          );
        }}
        isSubmitting={isShareSubmitting}
        submitError={shareSubmitError}
        onConfirm={async ({ name, description, newExtension }) => {
          try {
            setShareSubmitError(null);
            setIsShareSubmitting(true);

            const nodeNameError = buildProhibitedTermsError(
              "El nombre del nodo personalizado",
              name,
            );
            if (nodeNameError) {
              throw new Error(nodeNameError);
            }

            const effectiveDescription =
              description || `Subflujo compartido: ${name}`;

            const nodeDescriptionError = buildProhibitedTermsError(
              "La descripcion del nodo personalizado",
              effectiveDescription,
            );
            if (nodeDescriptionError) {
              throw new Error(nodeDescriptionError);
            }

            if (newExtension) {
              const extensionNameError = buildProhibitedTermsError(
                "El nombre de la extension",
                newExtension.name,
              );
              if (extensionNameError) {
                throw new Error(extensionNameError);
              }

              const extensionDescriptionError = buildProhibitedTermsError(
                "La descripcion de la extension",
                newExtension.description,
              );
              if (extensionDescriptionError) {
                throw new Error(extensionDescriptionError);
              }
            }

            if (!newExtension && selectedExtensionIds.length === 0) {
              setShareSubmitError(
                "Debes seleccionar al menos una extension para publicar.",
              );
              return;
            }

            const payload = {
              label: name,
              inCount,
              outCount,
              templateId: selfTemplateId,
              subflowNodes: subflowNodes ?? [],
              subflowEdges: subflowEdges ?? [],
            };

            const createdNode = await createCustomNode({
              name,
              description: effectiveDescription,
              code: JSON.stringify(payload),
            });

            const selectedUniqueIds = Array.from(new Set(selectedExtensionIds));
            const targetExtensionIds = [...selectedUniqueIds];

            if (newExtension) {
              try {
                const createdExt = await createExtension(newExtension);
                targetExtensionIds.push(createdExt.id);
                // invalidate so it shows up in sidebar/dialogs
                queryClient.invalidateQueries({ queryKey: ["extensions"] });
              } catch (extError) {
                console.error("Failed to create new extension:", extError);
                throw new Error("No se pudo crear la nueva extensión.");
              }
            }

            const failedExtensionNames: string[] = [];

            for (const extensionId of targetExtensionIds) {
              try {
                await addNodesToExtension({
                  extensionId,
                  nodeIds: [createdNode.id],
                });
              } catch {
                const extensionName =
                  myExtensions.find((extension) => extension.id === extensionId)
                    ?.name ?? extensionId;
                failedExtensionNames.push(extensionName);
              }
            }

            if (failedExtensionNames.length === targetExtensionIds.length) {
              throw new Error(
                "No se pudo asociar el subflujo a las extensiones seleccionadas.",
              );
            }

            if (failedExtensionNames.length > 0) {
              toast.warning(
                `Subflujo publicado, pero no se pudo asociar a: ${failedExtensionNames.join(", ")}.`,
              );
            } else {
              toast.success(
                `Subflujo publicado en ${targetExtensionIds.length} extension(es).`,
              );
            }

            setIsShareDialogOpen(false);
          } catch (error) {
            setShareSubmitError(
              error instanceof Error
                ? error.message
                : "No se pudo compartir el subflujo.",
            );
          } finally {
            setIsShareSubmitting(false);
          }
        }}
      />
      {!isSelfCall && config.dialog}
    </>
  );
});

SubflowNode.displayName = "SubflowNode";
