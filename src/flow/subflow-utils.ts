import type { Edge, Node } from "@xyflow/react";

type HandleKey = string | null;

type OpenPortSummary = {
  inCount: number;
  outCount: number;
  ready: boolean;
};

function uniqueCount<T>(values: T[]): number {
  return new Set(values).size;
}

function getHandleIds(
  nodeLookup: unknown,
  nodeId: string
): { targets: HandleKey[]; sources: HandleKey[]; hasBounds: boolean } {
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

  const hasBounds = internalNode?.internals?.handleBounds !== undefined;

  const targets = (internalNode?.internals?.handleBounds?.target ?? []).map(
    (h) => h.id ?? null
  );
  const sources = (internalNode?.internals?.handleBounds?.source ?? []).map(
    (h) => h.id ?? null
  );

  return { targets, sources, hasBounds };
}

export function computeOpenPortsFromLookup(
  nodes: Node[],
  edges: Edge[],
  nodeLookup: unknown
): OpenPortSummary {
  return computePortSummary(nodes, edges, nodeLookup, {
    includeDisconnectedWriteInputs: false,
  });
}

export function computeDanglingPortsFromLookup(
  nodes: Node[],
  edges: Edge[],
  nodeLookup: unknown
): OpenPortSummary {
  return computePortSummary(nodes, edges, nodeLookup, {
    includeDisconnectedWriteInputs: false,
  });
}

function computePortSummary(
  nodes: Node[],
  edges: Edge[],
  nodeLookup: unknown,
  options: { includeDisconnectedWriteInputs: boolean }
): OpenPortSummary {
  const nodeIds = nodes.map((n) => n.id);
  const selectedSet = new Set(nodeIds);

  const openInputs: string[] = [];
  const openOutputs: string[] = [];

  let ready = true;

  for (const nodeId of nodeIds) {
    const node = nodes.find((n) => String(n.id) === String(nodeId));
    const nodeType = node?.type;
    const { targets, sources, hasBounds } = getHandleIds(nodeLookup, nodeId);
    if (!hasBounds) {
      ready = false;
    }

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
        // Los nodos de escritura son sumideros internos. Sus entradas
        // vacías (in-1, in-2, ...) son puertos dinámicos para permitir
        // múltiples conexiones, pero no deberían contar como "entradas
        // abiertas" del subflujo hacia el exterior.
        if (!options.includeDisconnectedWriteInputs && nodeType === "write") {
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

  return {
    inCount: uniqueCount(openInputs),
    outCount: uniqueCount(openOutputs),
    ready,
  };
}
