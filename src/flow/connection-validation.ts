import type { Connection, Edge, Node } from "@xyflow/react";

import {
  describePortTypeMask,
  getPortTypeMask,
  isTypeCompatible,
} from "@/flow/port-data-type";

function safeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

export function validateConnection(
  nodes: Node[],
  edgeOrConnection: Edge | Connection
): { ok: boolean; message?: string } {
  const sourceId = safeString(edgeOrConnection.source);
  const targetId = safeString(edgeOrConnection.target);

  if (!sourceId || !targetId) {
    return { ok: true };
  }

  const sourceNode = nodes.find((n) => safeString(n.id) === sourceId);
  const targetNode = nodes.find((n) => safeString(n.id) === targetId);

  const sourceType =
    sourceNode && typeof sourceNode.type === "string" ? sourceNode.type : null;
  const targetType =
    targetNode && typeof targetNode.type === "string" ? targetNode.type : null;

  const sourceMask = getPortTypeMask({
    nodeType: sourceType,
    handleType: "source",
    handleId: edgeOrConnection.sourceHandle ?? null,
  });
  const targetMask = getPortTypeMask({
    nodeType: targetType,
    handleType: "target",
    handleId: edgeOrConnection.targetHandle ?? null,
  });

  const ok = isTypeCompatible({ sourceType: sourceMask, targetType: targetMask });
  if (ok) {
    return { ok: true };
  }

  return {
    ok: false,
    message: `No se puede conectar ${describePortTypeMask(
      sourceMask
    )} a ${describePortTypeMask(targetMask)}.`,
  };
}
