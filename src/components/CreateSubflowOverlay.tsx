import { useMemo } from "react";
import { useStore } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import {
  buildSubflowSnapshot,
  computeBounds,
  getHandleIds,
  uniqueCount,
  type FlowEdge,
  type FlowNode,
  type FlowBounds,
  type HandleKey,
  type SubflowSnapshot,
} from "@/utils/flow";
import { isSelectionConnected } from "@/utils/layout";

type SubflowPorts = { inCount: number; outCount: number };

type CreateSubflowRequest =
  | {
      ok: true;
      bounds: FlowBounds;
      ports: SubflowPorts;
      snapshot: SubflowSnapshot;
    }
  | { ok: false; bounds: FlowBounds; message: string };

export function CreateSubflowOverlay({
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
              const node = selectedNodes.find(
                (n) => String(n.id) === String(nodeId)
              );
              const nodeType = node?.type;
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

                const hasAnyIncoming = edges.some(
                  (e) =>
                    String(e.target) === nodeId &&
                    (e.targetHandle ?? null) === targetHandle
                );

                if (!hasInternalIncoming) {
                  // Para nodos "write": solo considerar la entrada
                  // como puerto del subflujo si realmente recibe
                  // alguna conexión (desde fuera de la selección).
                  // Los puertos dinámicos vacíos de Escribir no
                  // deben contarse como entradas posibles.
                  if (nodeType === "write" && !hasAnyIncoming) {
                    continue;
                  }

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

export type { CreateSubflowRequest };
