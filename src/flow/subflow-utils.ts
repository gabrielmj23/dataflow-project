import type { Edge, Node } from "@xyflow/react";

type HandleKey = string | null;

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
): { inCount: number; outCount: number; ready: boolean } {
  const nodeIds = nodes.map((n) => n.id);
  const selectedSet = new Set(nodeIds);

  const openInputs: string[] = [];
  const openOutputs: string[] = [];

  let ready = true;

  for (const nodeId of nodeIds) {
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
