import type { Edge, Node } from "@xyflow/react";

export type FlowNode = Node;
export type FlowEdge = Edge;
export type FlowBounds = { x: number; y: number; width: number; height: number };
export type SubflowSnapshot = { nodes: FlowNode[]; edges: FlowEdge[] };
export type HandleKey = string | null;

export function parseWriteTargetHandleIndex(handle: unknown): number {
  const m = /^in-(\d+)$/.exec(String(handle ?? ""));
  const idx = m ? parseInt(m[1] ?? "", 10) : NaN;
  return Number.isFinite(idx) ? idx : 0;
}

export function parseConditionalTargetHandleIndex(handle: unknown): number {
  const m = /^in-(\d+)$/.exec(String(handle ?? ""));
  const idx = m ? parseInt(m[1] ?? "", 10) : NaN;
  return Number.isFinite(idx) ? idx : 0;
}

export function clampWriteTemplateToMaxVar(
  template: unknown,
  maxVar: number
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

export function reconcileWriteGraph(
  nodes: FlowNode[],
  edges: FlowEdge[]
): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  changedNodes: boolean;
  changedEdges: boolean;
} {
  // Build per-write-node compaction maps based on current incoming connections.
  const writeMaps = new Map<
    string,
    {
      map: Map<number, number>;
      desiredInputCount: number;
      maxVarAllowed: number;
    }
  >();

  for (const n of nodes) {
    if (n.type !== "write") continue;
    const nodeId = String(n.id);

    const uniqueConnected = new Set<number>();
    for (const e of edges) {
      if (String(e.target) !== nodeId) continue;
      const idx = parseWriteTargetHandleIndex(e.targetHandle);
      if (idx > 0) uniqueConnected.add(idx);
    }

    const sorted = Array.from(uniqueConnected).sort((a, b) => a - b);
    const map = new Map<number, number>();
    for (let i = 0; i < sorted.length; i++) {
      const oldIdx = sorted[i];
      if (!oldIdx) continue;
      map.set(oldIdx, i + 1);
    }

    // If there are no connected inputs, keep a single empty handle only.
    // Otherwise keep one extra empty handle beyond the highest connected input.
    const desiredInputCount = sorted.length === 0 ? 1 : sorted.length + 1;
    const maxVarAllowed = desiredInputCount - 1;
    writeMaps.set(nodeId, { map, desiredInputCount, maxVarAllowed });
  }

  // 1) Update edges: shift targetHandle indices down to compact away gaps.
  let changedEdges = false;
  const nextEdges = edges.map((e) => {
    const targetId = String(e.target);
    const info = writeMaps.get(targetId);
    if (!info) return e;

    const oldIdx = parseWriteTargetHandleIndex(e.targetHandle);
    if (oldIdx <= 0) return e;

    const newIdx = info.map.get(oldIdx);
    if (!newIdx || newIdx === oldIdx) return e;

    changedEdges = true;
    return {
      ...e,
      targetHandle: `in-${newIdx}`,
    } as FlowEdge;
  });

  // 2) Update nodes: shrink inputCount to connectedCount+1 and remap template.
  let changedNodes = false;
  const nextNodes = nodes.map((n) => {
    if (n.type !== "write") return n;
    const nodeId = String(n.id);
    const info = writeMaps.get(nodeId);
    if (!info) return n;

    const data =
      n.data && typeof n.data === "object"
        ? (n.data as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const currentRaw =
      typeof data.inputCount === "number" ? data.inputCount : 1;
    const current = Number.isFinite(currentRaw)
      ? Math.max(1, Math.floor(currentRaw))
      : 1;

    const template = data.template;
    const remappedTemplate =
      typeof template !== "string"
        ? undefined
        : template.replace(/\{(\d+)\}/g, (_full, raw) => {
            const oldIdx = parseInt(String(raw), 10);
            if (!Number.isFinite(oldIdx)) return "";
            const newIdx = info.map.get(oldIdx);
            if (!newIdx) return "";
            // Also enforce max vars in case something goes out of bounds.
            return newIdx >= 1 && newIdx <= info.maxVarAllowed
              ? `{${newIdx}}`
              : "";
          });

    // If there are no connections, we keep only Entrada 1 + empty; strip placeholders.
    const clampedTemplate = clampWriteTemplateToMaxVar(
      remappedTemplate ?? template,
      info.maxVarAllowed
    );

    const needsInputCountUpdate = current !== info.desiredInputCount;
    const needsTemplateUpdate =
      typeof template === "string" && typeof clampedTemplate === "string"
        ? template !== clampedTemplate
        : false;

    if (!needsInputCountUpdate && !needsTemplateUpdate) return n;

    changedNodes = true;
    return {
      ...n,
      data: {
        ...data,
        ...(needsInputCountUpdate
          ? { inputCount: info.desiredInputCount }
          : null),
        ...(needsTemplateUpdate ? { template: clampedTemplate } : null),
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

type ConditionalInput = {
  id: string;
  label: string;
};

function labelForIndex(index: number): string {
  if (index <= 0) return "a";
  const code = 97 + ((index - 1) % 26);
  return String.fromCharCode(code);
}

export function reconcileConditionalGraph(
  nodes: FlowNode[],
  edges: FlowEdge[]
): {
  nodes: FlowNode[];
  edges: FlowEdge[];
  changedNodes: boolean;
  changedEdges: boolean;
} {
  const conditionalMaps = new Map<
    string,
    {
      map: Map<number, number>;
      desiredInputCount: number;
    }
  >();

  for (const n of nodes) {
    if (n.type !== "conditional") continue;
    const nodeId = String(n.id);

    const uniqueConnected = new Set<number>();
    for (const e of edges) {
      if (String(e.target) !== nodeId) continue;
      const idx = parseConditionalTargetHandleIndex(e.targetHandle);
      if (idx > 0) uniqueConnected.add(idx);
    }

    const sorted = Array.from(uniqueConnected).sort((a, b) => a - b);
    const map = new Map<number, number>();
    for (let i = 0; i < sorted.length; i++) {
      const oldIdx = sorted[i];
      if (!oldIdx) continue;
      map.set(oldIdx, i + 1);
    }

    const desiredInputCount = sorted.length === 0 ? 1 : sorted.length + 1;
    conditionalMaps.set(nodeId, { map, desiredInputCount });
  }

  let changedEdges = false;
  const nextEdges = edges.map((e) => {
    const targetId = String(e.target);
    const info = conditionalMaps.get(targetId);
    if (!info) return e;

    const oldIdx = parseConditionalTargetHandleIndex(e.targetHandle);
    if (oldIdx <= 0) return e;

    const newIdx = info.map.get(oldIdx);
    if (!newIdx || newIdx === oldIdx) return e;

    changedEdges = true;
    return {
      ...e,
      targetHandle: `in-${newIdx}`,
    } as FlowEdge;
  });

  let changedNodes = false;
  const nextNodes = nodes.map((n) => {
    if (n.type !== "conditional") return n;
    const nodeId = String(n.id);
    const info = conditionalMaps.get(nodeId);
    if (!info) return n;

    const data =
      n.data && typeof n.data === "object"
        ? (n.data as Record<string, unknown>)
        : ({} as Record<string, unknown>);

    const inputsRaw = data.inputs;
    const inputs: ConditionalInput[] = Array.isArray(inputsRaw)
      ? inputsRaw
          .map((item, idx) => {
            if (!item || typeof item !== "object") return null;
            const label = (item as { label?: unknown }).label;
            const safeLabel =
              typeof label === "string" && label.trim()
                ? label.trim()
                : labelForIndex(idx + 1);
            return { id: `in-${idx + 1}`, label: safeLabel };
          })
          .filter(Boolean) as ConditionalInput[]
      : [];

    const currentCount = inputs.length > 0 ? inputs.length : 1;
    const desiredCount = info.desiredInputCount;

    const needsInputCountUpdate = currentCount !== desiredCount;
    if (!needsInputCountUpdate && !changedEdges) return n;

    const remappedInputs: ConditionalInput[] = Array.from(
      { length: desiredCount },
      (_, i) => {
        const oldIdx = Array.from(info.map.entries()).find(
          ([, newIndex]) => newIndex === i + 1
        )?.[0];

        const existing = oldIdx ? inputs[oldIdx - 1] : inputs[i];
        return {
          id: `in-${i + 1}`,
          label: existing?.label ?? labelForIndex(i + 1),
        };
      }
    );

    changedNodes = true;
    return {
      ...n,
      data: {
        ...data,
        inputs: remappedInputs,
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
