import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ControlButton,
  SelectionMode,
  useStore,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type ReactFlowInstance,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./App.css";
import { Hand, MousePointer2, Download, Play, Upload } from "lucide-react";
import { nodeTypes } from "@/flow/node-types";
import { LabeledEdge } from "@/flow/labeled-edge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { nodePalette, type NodePaletteItem } from "./flow/node-palette";
import {
  SubflowTemplateContext,
  type SubflowTemplatePayload,
} from "@/flow/subflow-templates-context";
import {
  serializeProgram,
  downloadSerializedProgram,
  deserializeProgram,
  type SerializedProgramV1,
} from "@/flow/serialization";
import { deserializeProgramToEngineStores } from "@/engine/deserialize-program";
import { DataflowEngine } from "@/engine/engine";
import { nanoid } from "nanoid";

type FlowNode = Node;
type FlowEdge = Edge;

type FlowBounds = { x: number; y: number; width: number; height: number };

type SubflowPorts = { inCount: number; outCount: number };

type SubflowSnapshot = { nodes: FlowNode[]; edges: FlowEdge[] };

type SavedSubflowTemplate = {
  id: string;
  name: string;
  ports: SubflowPorts;
  snapshot: SubflowSnapshot;
};

type CreateSubflowRequest =
  | {
      ok: true;
      bounds: FlowBounds;
      ports: SubflowPorts;
      snapshot: SubflowSnapshot;
    }
  | { ok: false; bounds: FlowBounds; message: string };

type HandleKey = string | null;

function createNodeId(): string {
  return nanoid(16);
}

function isSelectionConnected(nodeIds: string[], edges: FlowEdge[]): boolean {
  if (nodeIds.length <= 1) {
    return true;
  }

  const idSet = new Set(nodeIds);
  const adjacency = new Map<string, Set<string>>();
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, new Set());
  }

  for (const edge of edges) {
    const source = String(edge.source);
    const target = String(edge.target);
    if (!idSet.has(source) || !idSet.has(target)) {
      continue;
    }
    adjacency.get(source)?.add(target);
    adjacency.get(target)?.add(source);
  }

  const start = nodeIds[0];
  if (!start) {
    return false;
  }

  const visited = new Set<string>();
  const queue: string[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const neighbors = adjacency.get(current);
    if (!neighbors) {
      continue;
    }
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) {
        continue;
      }
      visited.add(neighbor);
      queue.push(neighbor);
    }
  }

  return visited.size === nodeIds.length;
}

function uniqueCount<T>(values: T[]): number {
  return new Set(values).size;
}

function getHandleIds(
  nodeLookup: unknown,
  nodeId: string
): { targets: HandleKey[]; sources: HandleKey[] } {
  const map = nodeLookup as Map<string, unknown> | undefined;
  const internalNode = map?.get(nodeId) as
    | {
        internals?: {
          handleBounds?: {
            target?: Array<{ id?: string | null }>;
            source?: Array<{ id?: string | null }>;
          };
        };
      }
    | undefined;

  const targets = (internalNode?.internals?.handleBounds?.target ?? []).map(
    (h) => h.id ?? null
  );
  const sources = (internalNode?.internals?.handleBounds?.source ?? []).map(
    (h) => h.id ?? null
  );

  return { targets, sources };
}

function computeBounds(nodes: FlowNode[]): FlowBounds | null {
  if (nodes.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const width = node.measured?.width ?? 160;
    const height = node.measured?.height ?? 80;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function buildSubflowSnapshot(
  selectedNodes: FlowNode[],
  edges: FlowEdge[],
  bounds: FlowBounds
): SubflowSnapshot {
  const selectedSet = new Set(selectedNodes.map((n) => n.id));
  const padding = 40;

  const nodes = selectedNodes.map((n) => {
    const x = (n.position?.x ?? 0) - bounds.x + padding;
    const y = (n.position?.y ?? 0) - bounds.y + padding;
    return {
      id: n.id,
      type: n.type,
      position: {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
      },
      data: n.data,
      selected: false,
    } as FlowNode;
  });

  const internalEdges = edges
    .filter(
      (e) =>
        selectedSet.has(String(e.source)) && selectedSet.has(String(e.target))
    )
    .map(
      (e) =>
        ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          type: e.type,
          data: e.data,
        } as FlowEdge)
    );

  return { nodes, edges: internalEdges };
}

function CreateSubflowOverlay({
  selectedNodes,
  edges,
  onCreateClick,
}: {
  selectedNodes: FlowNode[];
  edges: FlowEdge[];
  onCreateClick: (request: CreateSubflowRequest) => void;
}) {
  const transform = useStore((state) => state.transform);
  const nodeLookup = useStore(
    (state) => (state as unknown as { nodeLookup: unknown }).nodeLookup
  );

  const bounds = useMemo(
    () => (selectedNodes.length > 1 ? computeBounds(selectedNodes) : null),
    [selectedNodes]
  );

  if (!bounds) {
    return null;
  }

  const selectedNodeIds = selectedNodes.map((n) => n.id);

  const [tx, ty, zoom] = transform;
  const left = (bounds.x + bounds.width / 2) * zoom + tx;
  const top = bounds.y * zoom + ty;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
        style={{ left, top }}
      >
        <Button
          size="sm"
          type="button"
          onClick={() => {
            if (!isSelectionConnected(selectedNodeIds, edges)) {
              onCreateClick({
                ok: false,
                bounds,
                message:
                  "Los nodos seleccionados deben estar conectados entre sí para crear un subflujo.",
              });
              return;
            }

            const openInputs: HandleKey[] = [];
            const openOutputs: HandleKey[] = [];

            const selectedSet = new Set(selectedNodeIds);

            for (const nodeId of selectedNodeIds) {
              const { targets, sources } = getHandleIds(nodeLookup, nodeId);

              for (const targetHandle of targets) {
                const hasInternalIncoming = edges.some((e) => {
                  const sourceId = String(e.source);
                  if (!selectedSet.has(sourceId)) {
                    return false;
                  }
                  if (String(e.target) !== nodeId) {
                    return false;
                  }
                  return (e.targetHandle ?? null) === targetHandle;
                });
                if (!hasInternalIncoming) {
                  openInputs.push(`${nodeId}:${String(targetHandle)}`);
                }
              }

              for (const sourceHandle of sources) {
                const hasInternalOutgoing = edges.some((e) => {
                  const targetId = String(e.target);
                  if (!selectedSet.has(targetId)) {
                    return false;
                  }
                  if (String(e.source) !== nodeId) {
                    return false;
                  }
                  return (e.sourceHandle ?? null) === sourceHandle;
                });
                if (!hasInternalOutgoing) {
                  openOutputs.push(`${nodeId}:${String(sourceHandle)}`);
                }
              }
            }

            // If we can't detect handles yet (e.g. nodes not measured), fall back to 0.
            const inCount = uniqueCount(openInputs);
            const outCount = uniqueCount(openOutputs);

            const snapshot = buildSubflowSnapshot(selectedNodes, edges, bounds);
            onCreateClick({
              ok: true,
              bounds,
              ports: { inCount, outCount },
              snapshot,
            });
          }}
        >
          Crear Subflujo
        </Button>
      </div>
    </div>
  );
}

const initialNodes: FlowNode[] = [];

const initialEdges: FlowEdge[] = [];

export default function App() {
  const [nodes, setNodes] = useState<FlowNode[]>(initialNodes);
  const [edges, setEdges] = useState<FlowEdge[]>(initialEdges);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const [canvasMode, setCanvasMode] = useState<"pan" | "select">("pan");

  const [subflowTemplates, setSubflowTemplates] = useState<
    SavedSubflowTemplate[]
  >([]);

  const [programName, setProgramName] = useState<string>("Sin título");

  type FlowSnapshot = { nodes: FlowNode[]; edges: FlowEdge[] };

  const [, setHistory] = useState<{
    stack: FlowSnapshot[];
    index: number;
  }>(() => ({
    stack: [{ nodes: initialNodes, edges: initialEdges }],
    index: 0,
  }));

  const isRestoringRef = useRef(false);
  const isDraggingRef = useRef(false);
  const historyTimeoutRef = useRef<number | null>(null);
  const clipboardRef = useRef<SubflowSnapshot | null>(null);

  const addOrUpdateTemplate = useCallback((payload: SubflowTemplatePayload) => {
    setSubflowTemplates((prev) => {
      const nextTemplate: SavedSubflowTemplate = {
        id: payload.id,
        name: payload.name,
        ports: {
          inCount: payload.inCount,
          outCount: payload.outCount,
        },
        snapshot: {
          nodes: payload.nodes as FlowNode[],
          edges: payload.edges as FlowEdge[],
        },
      };

      const index = prev.findIndex((tpl) => tpl.id === payload.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = nextTemplate;
        return copy;
      }

      return [...prev, nextTemplate];
    });
  }, []);

  const isNameTaken = useCallback(
    (name: string) => {
      const normalized = name.trim().toLowerCase();
      if (!normalized) return false;
      return subflowTemplates.some(
        (tpl) => tpl.name.trim().toLowerCase() === normalized
      );
    },
    [subflowTemplates]
  );

  const resolveTemplate = useCallback(
    (id: string) => {
      const tpl = subflowTemplates.find((t) => t.id === id);
      if (!tpl) return null;
      return {
        id: tpl.id,
        name: tpl.name,
        inCount: tpl.ports.inCount,
        outCount: tpl.ports.outCount,
        nodes: tpl.snapshot.nodes,
        edges: tpl.snapshot.edges,
      };
    },
    [subflowTemplates]
  );

  const draggingTypeRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const paletteLabelByType = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of nodePalette) {
      for (const item of category.items) {
        map.set(item.type, item.label);
      }
    }
    return map;
  }, []);

  const paletteCategories = useMemo(() => {
    if (!subflowTemplates.length) {
      return nodePalette;
    }

    return nodePalette.map((category) => {
      if (category.id !== "abstraction") {
        return category;
      }

      const extraItems = subflowTemplates.map<NodePaletteItem>((tpl) => ({
        type: "subflow",
        label: tpl.name,
        description: "Subflujo guardado",
        templateId: tpl.id,
      }));

      return {
        ...category,
        items: [...category.items, ...extraItems],
      };
    });
  }, [subflowTemplates]);

  const selectedNodes = useMemo(
    () => nodes.filter((node) => node.selected),
    [nodes]
  );

  const [isCreateSubflowOpen, setIsCreateSubflowOpen] = useState(false);
  const [subflowName, setSubflowName] = useState("");
  const [pendingSubflowBounds, setPendingSubflowBounds] =
    useState<FlowBounds | null>(null);
  const [pendingSubflowPorts, setPendingSubflowPorts] =
    useState<SubflowPorts | null>(null);
  const [pendingSubflowSnapshot, setPendingSubflowSnapshot] =
    useState<SubflowSnapshot | null>(null);
  const [createSubflowError, setCreateSubflowError] = useState<string | null>(
    null
  );
  const [createSubflowNameError, setCreateSubflowNameError] = useState<
    string | null
  >(null);
  const [addSubflowToPalette, setAddSubflowToPalette] = useState(false);
  const [pendingDeleteTemplateId, setPendingDeleteTemplateId] = useState<
    string | null
  >(null);
  const [pendingDeleteTemplateName, setPendingDeleteTemplateName] = useState<
    string | null
  >(null);

  const onCreateSubflowDialogChange = useCallback((open: boolean) => {
    setIsCreateSubflowOpen(open);
    if (!open) {
      setPendingSubflowBounds(null);
      setPendingSubflowPorts(null);
      setPendingSubflowSnapshot(null);
      setCreateSubflowError(null);
      setCreateSubflowNameError(null);
      setAddSubflowToPalette(false);
    }
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nodesSnapshot) => applyNodeChanges(changes, nodesSnapshot)),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) =>
      setEdges((edgesSnapshot) => applyEdgeChanges(changes, edgesSnapshot)),
    []
  );
  const onConnect = useCallback((params: Connection) => {
    const typed = params as Connection & { type?: string; data?: unknown };

    const newEdge: Edge = {
      id: createNodeId(),
      source: String(typed.source),
      target: String(typed.target),
      sourceHandle: typed.sourceHandle ?? null,
      targetHandle: typed.targetHandle ?? null,
      type: typed.type,
      data: (typed.data ?? {}) as Record<string, unknown>,
    };

    setEdges((edgesSnapshot) => addEdge(newEdge, edgesSnapshot));
  }, []);

  useEffect(() => {
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

      setNodes((prevNodes) => {
        const removedIds = new Set(
          prevNodes.filter((n) => n.selected).map((n) => n.id)
        );

        const nextNodes = prevNodes.filter((n) => !n.selected);

        setEdges((prevEdges) =>
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

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setNodes, setEdges]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type =
        event.dataTransfer.getData("application/reactflow") ||
        draggingTypeRef.current;
      if (!type) {
        return;
      }

      const templateIdRaw = event.dataTransfer.getData(
        "application/subflow-template-id"
      );
      const templateId = templateIdRaw || null;

      const instance = reactFlowInstance as
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

      const label = paletteLabelByType.get(type);
      let data: Record<string, unknown> = {};

      if (type === "subflow" && templateId) {
        const template = subflowTemplates.find((tpl) => tpl.id === templateId);
        if (template) {
          data = {
            label: template.name,
            inCount: template.ports.inCount,
            outCount: template.ports.outCount,
            subflowNodes: template.snapshot.nodes,
            subflowEdges: template.snapshot.edges,
            templateId: template.id,
          };
        } else if (label) {
          data = { label };
        }
      } else {
        if (label) {
          data = { label };
        }

        // Provide sensible defaults for common input/sequence nodes
        if (type === "constantInput") {
          data = {
            ...(data ?? {}),
            value: 0,
            label: (data.label as string) ?? "Constante",
          };
        }
        if (type === "randomInput") {
          data = {
            ...(data ?? {}),
            min: 0,
            max: 100,
            label: (data.label as string) ?? "Valor Aleatorio",
          };
        }
        if (type === "sequence") {
          data = {
            ...(data ?? {}),
            min: 0,
            max: 100,
            step: 1,
            label: (data.label as string) ?? "Generar Secuencia",
          };
        }
      }

      const newNode: FlowNode = {
        id: createNodeId(),
        type,
        position,
        data,
      };

      setNodes((prev) => [...prev, newNode]);
      draggingTypeRef.current = null;
    },
    [paletteLabelByType, reactFlowInstance, setNodes, subflowTemplates]
  );

  const onRunClick = useCallback(async () => {
    const viewport = reactFlowInstance?.getViewport?.();
    const program = serializeProgram({
      nodes,
      edges,
      viewport,
      programName,
    });

    try {
      const stores = deserializeProgramToEngineStores(program);
      const engine = new DataflowEngine();
      engine.loadProgram({
        nodes: stores.nodeStore.getNodes(),
        arcs: stores.arcStore.getArcs(),
      });

      const trace = { executedNodeIds: [] as string[], batches: 0 };
      await engine.run({
        initialTokens: [],
        maxSteps: 10_000,
        trace,
      });
    } catch (err) {
      console.error("Failed to load program into engine:", err);
    }
  }, [edges, nodes, programName, reactFlowInstance]);

  const onDownloadClick = useCallback(() => {
    if (!reactFlowInstance) return;
    const nodes = reactFlowInstance.getNodes();
    const edges = reactFlowInstance.getEdges();
    const viewport = reactFlowInstance.getViewport();
    const serialized = serializeProgram({
      nodes,
      edges,
      viewport,
      programName,
    });
    const base = programName?.trim() || `dataflow-program-${Date.now()}`;
    const safe = base.replace(/[^a-zA-Z0-9-_. ]+/g, "_");
    const filename = `${safe}.json`;
    downloadSerializedProgram(serialized, filename);
  }, [reactFlowInstance, programName]);

  const onLoadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onProgramFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? "");
          const parsed = JSON.parse(text) as SerializedProgramV1;

          if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
            console.error(
              "[dataflow] Versión de programa no soportada",
              parsed
            );
            window.alert(
              "No se pudo cargar el programa: archivo inválido o versión no soportada."
            );
            return;
          }

          const {
            nodes: desNodes,
            edges: desEdges,
            viewport,
            programName: loadedName,
          } = deserializeProgram(parsed);

          setNodes(desNodes as FlowNode[]);
          setEdges(desEdges as FlowEdge[]);

          if (loadedName && typeof loadedName === "string") {
            setProgramName(loadedName);
          }

          if (viewport && reactFlowInstance?.setViewport) {
            reactFlowInstance.setViewport(
              { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
              { duration: 0 }
            );
          }
        } catch (error) {
          console.error("[dataflow] Error al cargar programa", error);
          window.alert(
            "No se pudo cargar el programa: el archivo no contiene un JSON válido."
          );
        } finally {
          // Permite volver a seleccionar el mismo archivo si se desea
          event.target.value = "";
        }
      };

      reader.readAsText(file, "utf-8");
    },
    [reactFlowInstance, setNodes, setEdges]
  );

  const onPaletteDragStart = useCallback(
    (event: React.DragEvent, item: NodePaletteItem) => {
      draggingTypeRef.current = item.type;
      event.dataTransfer.setData("application/reactflow", item.type);
      event.dataTransfer.effectAllowed = "move";

      if (item.templateId) {
        event.dataTransfer.setData(
          "application/subflow-template-id",
          item.templateId
        );
      }

      try {
        const buttonEl = event.currentTarget as unknown as HTMLElement | null;
        const previewEl = buttonEl?.querySelector<HTMLElement>(
          "[data-drag-preview]"
        );
        if (previewEl) {
          event.dataTransfer.setDragImage(
            previewEl,
            Math.round(previewEl.offsetWidth / 2),
            Math.round(previewEl.offsetHeight / 2)
          );
        }
      } catch {
        // ignore
      }
    },
    []
  );
  const pushHistorySnapshot = useCallback(
    (snapshot?: FlowSnapshot) => {
      const currentSnapshot: FlowSnapshot = snapshot ?? {
        nodes,
        edges,
      };

      setHistory((prev) => {
        const truncated = prev.stack.slice(0, prev.index + 1);
        const last = truncated[truncated.length - 1];

        if (
          last &&
          last.nodes === currentSnapshot.nodes &&
          last.edges === currentSnapshot.edges
        ) {
          return prev;
        }

        truncated.push(currentSnapshot);

        const MAX_HISTORY = 50;
        const limitedStack =
          truncated.length > MAX_HISTORY
            ? truncated.slice(truncated.length - MAX_HISTORY)
            : truncated;

        return {
          stack: limitedStack,
          index: limitedStack.length - 1,
        };
      });
    },
    [edges, nodes]
  );

  const onNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
    if (historyTimeoutRef.current !== null) {
      window.clearTimeout(historyTimeoutRef.current);
      historyTimeoutRef.current = null;
    }
  }, []);

  const onNodeDragStop = useCallback(() => {
    isDraggingRef.current = false;
    pushHistorySnapshot();
  }, [pushHistorySnapshot]);

  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;

      if (isDraggingRef.current) {
        return;
      }
    }
    if (historyTimeoutRef.current !== null) {
      window.clearTimeout(historyTimeoutRef.current);
    }

    historyTimeoutRef.current = window.setTimeout(() => {
      pushHistorySnapshot();
    }, 200);

    return () => {
      if (historyTimeoutRef.current !== null) {
        window.clearTimeout(historyTimeoutRef.current);
      }
    };
  }, [nodes, edges, pushHistorySnapshot]);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.index <= 0) {
        return prev;
      }

      const newIndex = prev.index - 1;
      const snapshot = prev.stack[newIndex];

      if (!snapshot) {
        return prev;
      }

      isRestoringRef.current = true;
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);

      return {
        ...prev,
        index: newIndex,
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.index >= prev.stack.length - 1) {
        return prev;
      }

      const newIndex = prev.index + 1;
      const snapshot = prev.stack[newIndex];

      if (!snapshot) {
        return prev;
      }

      isRestoringRef.current = true;
      setNodes(snapshot.nodes);
      setEdges(snapshot.edges);

      return {
        ...prev,
        index: newIndex,
      };
    });
  }, []);

  const copySelection = useCallback(() => {
    const selectedNodesNow = nodes.filter((node) => node.selected);
    if (!selectedNodesNow.length) {
      return;
    }

    const bounds = computeBounds(selectedNodesNow);
    if (!bounds) {
      return;
    }

    const snapshot = buildSubflowSnapshot(selectedNodesNow, edges, bounds);
    clipboardRef.current = snapshot;
  }, [edges, nodes]);

  const pasteSelection = useCallback(() => {
    const snapshot = clipboardRef.current;
    if (!snapshot) {
      return;
    }

    const idMap = new Map<string, string>();
    const OFFSET = 30;

    const newNodes: FlowNode[] = snapshot.nodes.map((n) => {
      const newId = createNodeId();
      idMap.set(String(n.id), newId);
      const x = (n.position?.x ?? 0) + OFFSET;
      const y = (n.position?.y ?? 0) + OFFSET;

      return {
        ...n,
        id: newId,
        position: {
          x,
          y,
        },
        selected: true,
      } as FlowNode;
    });

    const newEdges: FlowEdge[] = snapshot.edges.map((e) => {
      const newId = createNodeId();
      const src = String(e.source);
      const tgt = String(e.target);

      return {
        ...e,
        id: newId,
        source: idMap.get(src) ?? src,
        target: idMap.get(tgt) ?? tgt,
        selected: false,
      } as FlowEdge;
    });

    setNodes((prev) => {
      const deselected = prev.map((n) => ({
        ...n,
        selected: false,
      }));
      return [...deselected, ...newNodes];
    });

    setEdges((prev) => [...prev, ...newEdges]);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const key = e.key.toLowerCase();
      const hasCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (isTextInput) {
        return;
      }

      if (hasCtrlOrMeta && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (hasCtrlOrMeta && key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (hasCtrlOrMeta && key === "c") {
        e.preventDefault();
        copySelection();
        return;
      }

      if (hasCtrlOrMeta && key === "v") {
        e.preventDefault();
        pasteSelection();
        return;
      }

      if (e.key !== "Delete" && e.key !== "Backspace") return;

      setNodes((prevNodes) => {
        const removedIds = new Set(
          prevNodes.filter((n) => n.selected).map((n) => n.id)
        );

        const nextNodes = prevNodes.filter((n) => !n.selected);

        setEdges((prevEdges) =>
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

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [copySelection, pasteSelection, redo, undo, setNodes, setEdges]);

  const openCreateSubflow = useCallback((request: CreateSubflowRequest) => {
    setPendingSubflowBounds(request.bounds);
    setSubflowName("");
    if (request.ok) {
      setPendingSubflowPorts(request.ports);
      setPendingSubflowSnapshot(request.snapshot);
      setCreateSubflowError(null);
      setCreateSubflowNameError(null);
    } else {
      setPendingSubflowPorts(null);
      setPendingSubflowSnapshot(null);
      setCreateSubflowError(request.message);
      setCreateSubflowNameError(null);
    }
    setIsCreateSubflowOpen(true);
  }, []);

  const createSubflow = useCallback(() => {
    const name = subflowName.trim();
    if (
      !name ||
      !pendingSubflowBounds ||
      !pendingSubflowPorts ||
      !pendingSubflowSnapshot
    ) {
      return;
    }

    if (addSubflowToPalette && isNameTaken(name)) {
      setCreateSubflowNameError(
        "Ya existe un subflujo en la paleta con ese nombre. Elige otro nombre."
      );
      return;
    }

    setCreateSubflowNameError(null);

    const maxIndex = nodes.reduce((max, n) => {
      const match = String(n.id).match(/^sf-(\d+)$/);
      const idx = match ? parseInt(match[1] ?? "0", 10) : 0;
      return Math.max(max, idx);
    }, 0);
    const next = maxIndex + 1;

    const x = pendingSubflowBounds.x + pendingSubflowBounds.width / 2 - 72;
    const y = pendingSubflowBounds.y - 90;

    const templateId = `sf-${next}`;

    setNodes((prev) => {
      const newNode: FlowNode = {
        id: templateId,
        position: {
          x: Number.isFinite(x) ? x : 0,
          y: Number.isFinite(y) ? y : 0,
        },
        data: {
          label: name,
          inCount: pendingSubflowPorts.inCount,
          outCount: pendingSubflowPorts.outCount,
          subflowNodes: pendingSubflowSnapshot.nodes,
          subflowEdges: pendingSubflowSnapshot.edges,
          templateId,
        },
        type: "subflow",
      };

      // Remove original selected nodes from main canvas
      const removedIds = new Set(
        pendingSubflowSnapshot.nodes.map((n) => String(n.id))
      );

      const remaining = prev.filter((n) => !removedIds.has(String(n.id)));

      return [...remaining, newNode];
    });
    if (addSubflowToPalette) {
      addOrUpdateTemplate({
        id: templateId,
        name,
        inCount: pendingSubflowPorts.inCount,
        outCount: pendingSubflowPorts.outCount,
        nodes: pendingSubflowSnapshot.nodes,
        edges: pendingSubflowSnapshot.edges,
      });
    }

    // Remove any edges connected to the removed nodes
    setEdges((prevEdges) =>
      prevEdges.filter((e) => {
        const src = String(e.source);
        const tgt = String(e.target);
        return (
          !pendingSubflowSnapshot.nodes.some((n) => String(n.id) === src) &&
          !pendingSubflowSnapshot.nodes.some((n) => String(n.id) === tgt)
        );
      })
    );

    setIsCreateSubflowOpen(false);
    setPendingSubflowBounds(null);
    setPendingSubflowPorts(null);
    setPendingSubflowSnapshot(null);
  }, [
    addSubflowToPalette,
    addOrUpdateTemplate,
    isNameTaken,
    nodes,
    pendingSubflowBounds,
    pendingSubflowPorts,
    pendingSubflowSnapshot,
    setNodes,
    subflowName,
  ]);

  return (
    <SidebarProvider>
      <AppSidebar
        categories={paletteCategories}
        onDragStart={onPaletteDragStart}
        onDeleteTemplate={(templateId) => {
          const match = subflowTemplates.find((tpl) => tpl.id === templateId);
          setPendingDeleteTemplateId(templateId);
          setPendingDeleteTemplateName(match ? match.name : null);
        }}
      />

      <SidebarInset>
        <div className="relative flex h-svh w-full">
          <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
            <SidebarTrigger />
            <div className="flex items-center">
              <Input
                value={programName}
                onChange={(e) => setProgramName(e.currentTarget.value)}
                placeholder="Nombre del programa"
                className="w-40 text-sm bg-white"
              />
            </div>
          </div>

          <SubflowTemplateContext.Provider
            value={{ addOrUpdateTemplate, isNameTaken, resolveTemplate }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={{ default: LabeledEdge }}
              onInit={setReactFlowInstance}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
              panOnDrag={canvasMode === "pan"}
              selectionOnDrag={canvasMode === "select"}
              selectionMode={SelectionMode.Partial}
              className={
                canvasMode === "pan" ? "rf-mode-pan" : "rf-mode-select"
              }
              fitView
              proOptions={{ hideAttribution: true }}
            >
              <CreateSubflowOverlay
                selectedNodes={selectedNodes}
                edges={edges}
                onCreateClick={openCreateSubflow}
              />
              <Background variant={BackgroundVariant.Dots} />
              <Controls>
                <ControlButton
                  onClick={() => setCanvasMode("pan")}
                  aria-pressed={canvasMode === "pan"}
                  title="Modo arrastrar (mover canvas)"
                  className="rf-mode-toggle"
                >
                  <Hand className="rf-icon-hand" />
                </ControlButton>
                <ControlButton
                  onClick={() => setCanvasMode("select")}
                  aria-pressed={canvasMode === "select"}
                  title="Modo selección (cuadro)"
                  className="rf-mode-toggle"
                >
                  <MousePointer2 />
                </ControlButton>
              </Controls>
              <MiniMap />
              <Panel position="top-right" className="flex gap-2">
                <Button
                  variant="secondary"
                  className="hover:cursor-pointer shadow-md"
                  type="button"
                  onClick={onRunClick}
                  disabled={nodes.length === 0}
                >
                  Ejecutar
                  <Play
                    fill="oklch(72.3% 0.219 149.579)"
                    className="text-green-500"
                  />
                </Button>
                <Button
                  variant="secondary"
                  className="hover:cursor-pointer shadow-md"
                  type="button"
                  onClick={onDownloadClick}
                  disabled={nodes.length === 0}
                >
                  Descargar
                  <Download />
                </Button>
                <Button
                  variant="secondary"
                  className="hover:cursor-pointer shadow-md"
                  type="button"
                  onClick={onLoadClick}
                >
                  Cargar
                  <Upload />
                </Button>
              </Panel>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={onProgramFileChange}
              />
            </ReactFlow>
          </SubflowTemplateContext.Provider>
        </div>

        <Dialog
          open={isCreateSubflowOpen}
          onOpenChange={onCreateSubflowDialogChange}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Subflujo</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {createSubflowError ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {createSubflowError}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Entradas: {pendingSubflowPorts?.inCount ?? 0} · Salidas:{" "}
                    {pendingSubflowPorts?.outCount ?? 0}
                  </p>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-900">
                      Nombre del subflujo:
                    </label>
                    <Input
                      value={subflowName}
                      onChange={(e) => {
                        setSubflowName(e.currentTarget.value);
                        setCreateSubflowNameError(null);
                      }}
                      placeholder="Ej: Validar datos"
                    />
                  </div>
                  {createSubflowNameError && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                      {createSubflowNameError}
                    </div>
                  )}
                  <label className="mt-1 flex items-center gap-2 text-sm text-gray-900">
                    <input
                      type="checkbox"
                      className="h-3 w-3"
                      checked={addSubflowToPalette}
                      onChange={(e) => {
                        setAddSubflowToPalette(e.currentTarget.checked);
                        setCreateSubflowNameError(null);
                      }}
                    />
                    <span>Añadir este subflujo a la paleta</span>
                  </label>
                </>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onCreateSubflowDialogChange(false)}
                >
                  {createSubflowError ? "Cerrar" : "Cancelar"}
                </Button>
                {!createSubflowError && (
                  <Button
                    type="button"
                    disabled={
                      !subflowName.trim() ||
                      !pendingSubflowBounds ||
                      !pendingSubflowPorts ||
                      (addSubflowToPalette && !!createSubflowNameError)
                    }
                    onClick={createSubflow}
                  >
                    Guardar
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>

      <Dialog
        open={pendingDeleteTemplateId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteTemplateId(null);
            setPendingDeleteTemplateName(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar subflujo de la paleta</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ¿Seguro que quieres eliminar{" "}
              {pendingDeleteTemplateName
                ? `"${pendingDeleteTemplateName}"`
                : "este subflujo"}{" "}
              de la paleta? Los nodos ya colocados en el diagrama no se
              borrarán.
            </p>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPendingDeleteTemplateId(null);
                  setPendingDeleteTemplateName(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (pendingDeleteTemplateId) {
                    setSubflowTemplates((prev) =>
                      prev.filter((tpl) => tpl.id !== pendingDeleteTemplateId)
                    );
                  }
                  setPendingDeleteTemplateId(null);
                  setPendingDeleteTemplateName(null);
                }}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
