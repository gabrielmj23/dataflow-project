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
import { Download, Play, PlusCircle } from "lucide-react";
import { nodeTypes } from "@/flow/node-types";
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
import { nodePalette } from "./flow/node-palette";
import {
  serializeProgram,
  downloadSerializedProgram,
} from "@/flow/serialization";
import { nanoid } from "nanoid";

type FlowNode = Node;
type FlowEdge = Edge;

type FlowBounds = { x: number; y: number; width: number; height: number };

type SubflowPorts = { inCount: number; outCount: number };

type SubflowSnapshot = { nodes: FlowNode[]; edges: FlowEdge[] };

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

  const [programName, setProgramName] = useState<string>("Sin título");

  const draggingTypeRef = useRef<string | null>(null);

  const paletteLabelByType = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of nodePalette) {
      for (const item of category.items) {
        map.set(item.type, item.label);
      }
    }
    return map;
  }, []);

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

  const onCreateSubflowDialogChange = useCallback((open: boolean) => {
    setIsCreateSubflowOpen(open);
    if (!open) {
      setPendingSubflowBounds(null);
      setPendingSubflowPorts(null);
      setPendingSubflowSnapshot(null);
      setCreateSubflowError(null);
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
      let data: Record<string, unknown> = label ? { label } : {};

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

      const newNode: FlowNode = {
        id: createNodeId(),
        type,
        position,
        data,
      };

      setNodes((prev) => [...prev, newNode]);
      draggingTypeRef.current = null;
    },
    [paletteLabelByType, reactFlowInstance, setNodes]
  );

  const onRunClick = useCallback(() => {
    const viewport = reactFlowInstance?.getViewport?.();
    const program = serializeProgram({ nodes, edges, viewport });
    console.log("[dataflow] serialized program", program);
  }, [edges, nodes, reactFlowInstance]);

  const onDownloadClick = useCallback(() => {
    if (!reactFlowInstance) return;
    const nodes = reactFlowInstance.getNodes();
    const edges = reactFlowInstance.getEdges();
    const viewport = reactFlowInstance.getViewport();
    const serialized = serializeProgram({ nodes, edges, viewport });
    const base = programName?.trim() || `dataflow-program-${Date.now()}`;
    const safe = base.replace(/[^a-zA-Z0-9-_. ]+/g, "_");
    const filename = `${safe}.json`;
    downloadSerializedProgram(serialized, filename);
  }, [reactFlowInstance, programName]);

  const onPaletteDragStart = useCallback(
    (event: React.DragEvent, item: { type: string; label: string }) => {
      draggingTypeRef.current = item.type;
      event.dataTransfer.setData("application/reactflow", item.type);
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const addNode = useCallback(() => {
    setNodes((prev) => {
      const maxIndex = prev.reduce((max, n) => {
        const m = String(n.id).match(/^n(\d+)$/);
        const idx = m ? parseInt(m[1], 10) : 0;
        return Math.max(max, idx);
      }, 0);
      const next = maxIndex + 1;
      const newNode = {
        id: `n${next}`,
        position: { x: 0, y: next * 140 },
        data: {
          title: `Nodo base ${next}`,
          description: "Nodo creado dinámicamente a partir del esqueleto base.",
          footerActionLabel: "Acción",
        },
        type: "baseNode" as FlowNode["type"],
      };
      return [...prev, newNode];
    });
  }, []);

  const openCreateSubflow = useCallback((request: CreateSubflowRequest) => {
    setPendingSubflowBounds(request.bounds);
    setSubflowName("");
    if (request.ok) {
      setPendingSubflowPorts(request.ports);
      setPendingSubflowSnapshot(request.snapshot);
      setCreateSubflowError(null);
    } else {
      setPendingSubflowPorts(null);
      setPendingSubflowSnapshot(null);
      setCreateSubflowError(request.message);
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

    setNodes((prev) => {
      const maxIndex = prev.reduce((max, n) => {
        const match = String(n.id).match(/^sf-(\d+)$/);
        const idx = match ? parseInt(match[1] ?? "0", 10) : 0;
        return Math.max(max, idx);
      }, 0);
      const next = maxIndex + 1;

      const x = pendingSubflowBounds.x + pendingSubflowBounds.width / 2 - 72;
      const y = pendingSubflowBounds.y - 90;

      const newNode: FlowNode = {
        id: `sf-${next}`,
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
        },
        type: "subflow",
      };

      return [...prev, newNode];
    });

    setIsCreateSubflowOpen(false);
    setPendingSubflowBounds(null);
    setPendingSubflowPorts(null);
    setPendingSubflowSnapshot(null);
  }, [
    pendingSubflowBounds,
    pendingSubflowPorts,
    pendingSubflowSnapshot,
    setNodes,
    subflowName,
  ]);

  return (
    <SidebarProvider>
      <AppSidebar categories={nodePalette} onDragStart={onPaletteDragStart} />

      <SidebarInset>
        <div className="relative flex h-svh w-full">
          <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
            <SidebarTrigger />
            <div className="flex items-center">
              <Input
                value={programName}
                onChange={(e) => setProgramName(e.currentTarget.value)}
                placeholder="Nombre del programa"
                className="w-40 text-sm"
              />
            </div>
          </div>

          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={setReactFlowInstance}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
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
              <ControlButton onClick={addNode}>
                <PlusCircle color="white" />
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
            </Panel>
          </ReactFlow>
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
                      onChange={(e) => setSubflowName(e.currentTarget.value)}
                      placeholder="Ej: Validar datos"
                    />
                  </div>
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
                      !pendingSubflowPorts
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
    </SidebarProvider>
  );
}
