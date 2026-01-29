import { applyNodeChanges, type Edge, type EdgeChange, type Node, type NodeChange } from "@xyflow/react";

type PairEntry = {
  conditional?: Node;
  selector?: Node;
  offset: number;
};

type PairMeta = {
  pairId: string | null;
  role: string | null;
  offset: number;
};

function getPairMeta(node: Node): PairMeta {
  const data =
    node.data && typeof node.data === "object"
      ? (node.data as Record<string, unknown>)
      : null;
  const pairId = data?.pairId ? String(data.pairId) : null;
  const role = data?.pairRole ? String(data.pairRole) : null;
  const offsetRaw = data?.pairOffsetY;
  const offset = Number.isFinite(Number(offsetRaw)) ? Number(offsetRaw) : 160;
  return { pairId, role, offset };
}

export function handlePairedNodeChanges(params: {
  changes: NodeChange[];
  nodes: Node[];
  edges: Edge[];
}): { nextNodes: Node[]; nextEdges: Edge[] } {
  const { changes, nodes, edges } = params;

  const removedChanges = changes.filter((change) => change.type === "remove");
  let expandedChanges = changes;
  let nextEdges = edges;

  if (removedChanges.length > 0) {
    const removedIds = new Set(removedChanges.map((change) => String(change.id)));
    const removedPairIds = new Set<string>();

    for (const node of nodes) {
      if (!removedIds.has(String(node.id))) continue;
      const { pairId } = getPairMeta(node);
      if (pairId) removedPairIds.add(pairId);
    }

    if (removedPairIds.size > 0) {
      for (const node of nodes) {
        const { pairId } = getPairMeta(node);
        if (pairId && removedPairIds.has(pairId)) {
          removedIds.add(String(node.id));
        }
      }

      expandedChanges = changes.concat(
        Array.from(removedIds)
          .filter((id) => !removedChanges.some((c) => String(c.id) === id))
          .map((id) => ({ type: "remove", id }) as NodeChange),
      );

      nextEdges = edges.filter((edge) => {
        const data =
          edge.data && typeof edge.data === "object"
            ? (edge.data as Record<string, unknown>)
            : null;
        const edgePairId = data?.pairId ? String(data.pairId) : null;
        if (edgePairId && removedPairIds.has(edgePairId)) return false;
        if (
          removedIds.has(String(edge.source)) ||
          removedIds.has(String(edge.target))
        ) {
          return false;
        }
        return true;
      });
    }
  }

  const nextNodes = applyNodeChanges(expandedChanges, nodes);

  const movedIds = new Set(
    expandedChanges
      .filter((change) => change.type === "position")
      .map((change) => String(change.id)),
  );

  if (movedIds.size === 0) {
    return { nextNodes, nextEdges };
  }

  const pairs = new Map<string, PairEntry>();

  for (const node of nextNodes) {
    const { pairId, role, offset } = getPairMeta(node);
    if (!pairId) continue;
    const entry = pairs.get(pairId) ?? { offset };
    entry.offset = offset;
    if (role === "conditional") entry.conditional = node;
    if (role === "selector") entry.selector = node;
    pairs.set(pairId, entry);
  }

  if (pairs.size === 0) {
    return { nextNodes, nextEdges };
  }

  const overrides = new Map<string, { x: number; y: number }>();

  for (const [, pair] of pairs.entries()) {
    const conditional = pair.conditional;
    const selector = pair.selector;
    if (!conditional || !selector) continue;

    const conditionalMoved = movedIds.has(String(conditional.id));
    const selectorMoved = movedIds.has(String(selector.id));
    if (!conditionalMoved && !selectorMoved) continue;

    const offset = pair.offset;

    if (conditionalMoved) {
      overrides.set(String(selector.id), {
        x: conditional.position.x,
        y: conditional.position.y + offset,
      });
    } else if (selectorMoved) {
      overrides.set(String(conditional.id), {
        x: selector.position.x,
        y: selector.position.y - offset,
      });
    }
  }

  if (overrides.size === 0) {
    return { nextNodes, nextEdges };
  }

  const adjustedNodes = nextNodes.map((node) => {
    const nextPos = overrides.get(String(node.id));
    if (!nextPos) return node;
    return {
      ...node,
      position: nextPos,
    } as Node;
  });

  return { nextNodes: adjustedNodes, nextEdges };
}

export function filterLockedEdgeChanges(
  changes: EdgeChange[],
  edges: Edge[],
): EdgeChange[] {
  const lockedEdgeIds = new Set(
    edges
      .filter((edge) => {
        const data =
          edge.data && typeof edge.data === "object"
            ? (edge.data as Record<string, unknown>)
            : null;
        const lockedFlag = (edge.data as { locked?: unknown })?.locked === true;
        const deletableFlag = edge.deletable === false;
        const dataLocked = data?.locked === true;
        return lockedFlag || dataLocked || deletableFlag;
      })
      .map((edge) => String(edge.id)),
  );

  return changes.filter((change) => {
    if (change.type !== "remove") return true;
    return !lockedEdgeIds.has(String(change.id));
  });
}

type CreateConditionalPairOptions = {
  position: { x: number; y: number };
  createId: () => string;
  offsetY?: number;
};

export function createConditionalPair(options: CreateConditionalPairOptions): {
  nodes: [Node, Node];
  edge: Edge;
} {
  const { position, createId, offsetY = 160 } = options;

  const conditionalId = createId();
  const selectorId = createId();
  const pairId = createId();

  const conditionalNode: Node = {
    id: conditionalId,
    type: "conditional",
    position,
    data: {
      label: "Condicional",
      pairId,
      pairRole: "conditional",
      pairOffsetY: offsetY,
    },
  };

  const selectorNode: Node = {
    id: selectorId,
    type: "selector",
    position: { x: position.x, y: position.y + offsetY },
    data: {
      label: "Selector",
      pairId,
      pairRole: "selector",
      pairOffsetY: offsetY,
    },
  };

  const edge: Edge = {
    id: createId(),
    source: conditionalId,
    sourceHandle: "out",
    target: selectorId,
    targetHandle: "token",
    type: "default",
    deletable: false,
    focusable: false,
    interactionWidth: 0,
    data: { edgeType: "straight", pairId, locked: true },
  } as Edge;

  return { nodes: [conditionalNode, selectorNode], edge };
}
