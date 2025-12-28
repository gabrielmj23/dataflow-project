import type { Edge, Node, Viewport } from "@xyflow/react";

export type SerializedViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type SerializedNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data?: unknown;
};

export type SerializedEdge = {
  id: string;
  type?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: unknown;
};

export type SerializedProgramV1 = {
  version: 1;
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  viewport?: SerializedViewport;
};

function jsonClone<T>(value: T): T {
  // Node/edge data in this app is expected to be JSON-serializable.
  return JSON.parse(JSON.stringify(value)) as T;
}

export function serializeProgram(params: {
  nodes: Node[];
  edges: Edge[];
  viewport?: Viewport | SerializedViewport;
}): SerializedProgramV1 {
  const viewport = params.viewport
    ? {
        x: params.viewport.x,
        y: params.viewport.y,
        zoom: params.viewport.zoom,
      }
    : undefined;

  const nodes: SerializedNode[] = params.nodes.map((n) => ({
    id: String(n.id),
    type: n.type,
    position: {
      x: Number(n.position?.x ?? 0),
      y: Number(n.position?.y ?? 0),
    },
    data: n.data === undefined ? undefined : jsonClone(n.data),
  }));

  const edges: SerializedEdge[] = params.edges.map((e) => ({
    id: String(e.id),
    type: e.type,
    source: String(e.source),
    target: String(e.target),
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    data: e.data === undefined ? undefined : jsonClone(e.data),
  }));

  return {
    version: 1,
    nodes,
    edges,
    viewport,
  };
}

export function deserializeProgram(serialized: SerializedProgramV1): {
  nodes: Node[];
  edges: Edge[];
  viewport?: SerializedViewport;
} {
  const nodes: Node[] = serialized.nodes.map((n) => {
    const data = n.data === undefined ? {} : jsonClone(n.data);
    return {
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      data: (data ?? {}) as Record<string, unknown>,
    };
  });

  const edges: Edge[] = serialized.edges.map((e) => {
    const data = e.data === undefined ? undefined : jsonClone(e.data);
    return {
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? undefined,
      targetHandle: e.targetHandle ?? undefined,
      data: data === null ? undefined : (data as Record<string, unknown>),
    };
  });

  return { nodes, edges, viewport: serialized.viewport };
}
