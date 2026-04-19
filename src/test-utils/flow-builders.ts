import type { Edge, Node, XYPosition } from "@xyflow/react";

export function makeNode(params: {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  position?: XYPosition;
}): Node {
  return {
    id: params.id,
    type: params.type,
    data: params.data ?? {},
    position: params.position ?? { x: 0, y: 0 },
  };
}

export function makeEdge(params: {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}): Edge {
  return {
    id: params.id,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle,
    targetHandle: params.targetHandle,
  };
}
