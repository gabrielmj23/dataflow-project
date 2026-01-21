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

  const sourceHandle = edgeOrConnection.sourceHandle ?? null;
  const targetHandle = edgeOrConnection.targetHandle ?? null;

  // Lock conditional -> selector pair: only allow the fixed connection.
  const sourceIsConditionalOut =
    sourceType === "conditional" && sourceHandle === "out";
  const targetIsSelectorToken =
    targetType === "selector" && targetHandle === "token";

  if (sourceIsConditionalOut || targetIsSelectorToken) {
    if (!(sourceIsConditionalOut && targetIsSelectorToken)) {
      return {
        ok: false,
        message: "La conexión Condicional → Selector es fija.",
      };
    }

    const sourceData =
      sourceNode && typeof sourceNode === "object" ? (sourceNode as { data?: unknown }).data : null;
    const targetData =
      targetNode && typeof targetNode === "object" ? (targetNode as { data?: unknown }).data : null;
    const sourcePairId =
      sourceData && typeof sourceData === "object" ? (sourceData as { pairId?: unknown }).pairId : null;
    const targetPairId =
      targetData && typeof targetData === "object" ? (targetData as { pairId?: unknown }).pairId : null;

    if (!sourcePairId || !targetPairId || String(sourcePairId) !== String(targetPairId)) {
      return {
        ok: false,
        message: "Condicional y Selector deben pertenecer al mismo par.",
      };
    }
  }

  const sourceMask = getPortTypeMask({
    nodeType: sourceType,
    handleType: "source",
    handleId: sourceHandle,
  });
  const targetMask = getPortTypeMask({
    nodeType: targetType,
    handleType: "target",
    handleId: targetHandle,
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
