import type { Edge, Node } from "@xyflow/react";

export type FlowNode = Node;
export type FlowEdge = Edge;
export type FlowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type SubflowSnapshot = { nodes: FlowNode[]; edges: FlowEdge[] };
export type HandleKey = string | null;

export function parseWriteTargetHandleIndex(handle: unknown): number {
  const m = /^in-(\d+)$/.exec(String(handle ?? ""));
  const idx = m ? parseInt(m[1] ?? "", 10) : NaN;
  return Number.isFinite(idx) ? idx : 0;
}

// Note: conditional input reconciliation based on edges was removed.
// Parsing of conditional handle indices is no longer required.

export function clampWriteTemplateToMaxVar(
  template: unknown,
  maxVar: number,
): string | undefined {
  if (typeof template !== "string") return undefined;
  if (!Number.isFinite(maxVar) || maxVar < 1) {
    // No valid variables allowed; strip all placeholders.
    return template.replace(/\{\d+\}/g, "");
  }

  return template.replace(/\{(\d+)\}/g, (full, raw) => {
    const idx = parseInt(String(raw), 10);
    if (!Number.isFinite(idx)) return "";
    return idx >= 1 && idx <= maxVar ? full : "";
  });
}

function normalizeWriteInputLabels(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};

  const next: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const m = /^in-(\d+)$/.exec(String(key ?? ""));
    if (!m) continue;
    const idx = Number(m[1]);
    if (!Number.isFinite(idx) || idx <= 0) continue;
    if (typeof raw !== "string") continue;
    next[`in-${idx}`] = raw;
  }
  return next;
}

function clampWriteInputLabelsToCount(
  labels: Record<string, string>,
  inputCount: number,
): Record<string, string> {
  const safeCount = Math.max(1, Math.floor(inputCount));
  const clamped: Record<string, string> = {};

  for (const [handleId, label] of Object.entries(labels)) {
    const idx = parseWriteTargetHandleIndex(handleId);
    if (idx < 1 || idx > safeCount) continue;
    clamped[`in-${idx}`] = label;
  }

  return clamped;
}

function labelsEqual(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
}

export function reconcileWriteGraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  changedNodes: boolean;
  changedEdges: boolean;
} {
  const existingNodeIds = new Set(nodes.map((node) => String(node.id)));

  const inputCountByNodeId = new Map<string, number>();
  for (const n of nodes) {
    if (n.type !== "write") continue;

    const data =
      n.data && typeof n.data === "object"
        ? (n.data as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const currentRaw =
      typeof data.inputCount === "number" ? data.inputCount : 1;
    const inputCount = Number.isFinite(currentRaw)
      ? Math.max(1, Math.floor(currentRaw))
      : 1;

    inputCountByNodeId.set(String(n.id), inputCount);
  }

  let changedEdges = false;
  const edgesWithExistingNodes = edges.filter((edge) => {
    const sourceId = String(edge.source);
    const targetId = String(edge.target);
    return existingNodeIds.has(sourceId) && existingNodeIds.has(targetId);
  });
  if (edgesWithExistingNodes.length !== edges.length) {
    changedEdges = true;
  }

  const nextEdges = edgesWithExistingNodes.filter((e) => {
    const targetId = String(e.target);
    const inputCount = inputCountByNodeId.get(targetId);
    if (!inputCount) return true;

    const idx = parseWriteTargetHandleIndex(e.targetHandle);
    if (idx <= 0) return true;
    if (idx <= inputCount) return true;

    changedEdges = true;
    return false;
  });

  let changedNodes = false;
  const nextNodes = nodes.map((n) => {
    if (n.type !== "write") return n;
    const nodeId = String(n.id);
    const inputCount = inputCountByNodeId.get(nodeId) ?? 1;

    const data =
      n.data && typeof n.data === "object"
        ? (n.data as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const template = data.template;
    const inputLabels = normalizeWriteInputLabels(data.inputLabels);
    const clampedTemplate = clampWriteTemplateToMaxVar(template, inputCount);
    const clampedInputLabels = clampWriteInputLabelsToCount(
      inputLabels,
      inputCount,
    );
    const needsTemplateUpdate =
      typeof template === "string" && typeof clampedTemplate === "string"
        ? template !== clampedTemplate
        : false;
    const needsInputLabelsUpdate = !labelsEqual(
      inputLabels,
      clampedInputLabels,
    );

    if (!needsTemplateUpdate && !needsInputLabelsUpdate) return n;

    changedNodes = true;
    const hasInputLabels = Object.keys(clampedInputLabels).length > 0;
    return {
      ...n,
      data: {
        ...data,
        ...(needsTemplateUpdate ? { template: clampedTemplate } : null),
        ...(needsInputLabelsUpdate
          ? hasInputLabels
            ? { inputLabels: clampedInputLabels }
            : { inputLabels: undefined }
          : null),
      },
    } as FlowNode;
  });

  return {
    nodes: changedNodes ? nextNodes : nodes,
    edges: changedEdges ? nextEdges : edges,
    changedNodes,
    changedEdges,
  };
}

export function uniqueCount<T>(values: T[]): number {
  return new Set(values).size;
}

export function getHandleIds(
  nodeLookup: unknown,
  nodeId: string,
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
    (h) => h.id ?? null,
  );
  const sources = (internalNode?.internals?.handleBounds?.source ?? []).map(
    (h) => h.id ?? null,
  );

  return { targets, sources };
}

export function computeBounds(nodes: FlowNode[]): FlowBounds | null {
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

export function buildSubflowSnapshot(
  selectedNodes: FlowNode[],
  edges: FlowEdge[],
  bounds: FlowBounds,
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
        selectedSet.has(String(e.source)) && selectedSet.has(String(e.target)),
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
        }) as FlowEdge,
    );

  return { nodes, edges: internalEdges };
}
