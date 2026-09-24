import type { Edge, Node } from "@xyflow/react";
import {
  computeDanglingPortsFromLookup,
  computeOpenPortsFromLookup,
} from "@/flow/subflow-utils";

type ValidationMessages = {
  emptyInputs: string;
  tooManyOutputs: string;
  danglingPorts: (inputCount: number, outputCount: number) => string;
};

const DEFAULT_MESSAGES: ValidationMessages = {
  emptyInputs:
    "Hay entradas sin nombre. Asigna un nombre a todas las entradas antes de guardar.",
  tooManyOutputs:
    "El subflujo no puede exponer más de 1 salida. Unifica o cierra salidas antes de guardar.",
  danglingPorts: (inputCount, outputCount) =>
    `Hay nodos con entradas/salidas abiertas (${inputCount} entrada(s), ${outputCount} salida(s)). Conecta todos los puertos antes de guardar.`,
};

export type ValidateSubflowDraftForSaveParams = {
  nodes: Node[];
  edges: Edge[];
  lookup: unknown;
  draftLabel: string;
  currentLabel: string;
  rawInCount?: number;
  rawOutCount?: number;
  fallbackInCount: number;
  fallbackOutCount: number;
  messages?: Partial<ValidationMessages>;
};

export type ValidateSubflowDraftForSaveResult =
  | {
      ok: false;
      error: string;
    }
  | {
      ok: true;
      finalLabel: string;
      nextInCount: number;
      nextOutCount: number;
      edgesForSave: Edge[];
    };

export function validateSubflowDraftForSave(
  params: ValidateSubflowDraftForSaveParams,
): ValidateSubflowDraftForSaveResult {
  const messages: ValidationMessages = {
    ...DEFAULT_MESSAGES,
    ...params.messages,
    danglingPorts:
      params.messages?.danglingPorts ?? DEFAULT_MESSAGES.danglingPorts,
  };

  const nodeIds = new Set(params.nodes.map((node) => String(node.id)));
  const edgesForSave = params.edges.filter(
    (edge) =>
      nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target)),
  );

  const explicitInputs = params.nodes.filter(
    (node) => String(node.type) === "subflowInput",
  ).length;
  const nextInCount = Number.isFinite(Number(explicitInputs))
    ? explicitInputs
    : Number.isFinite(params.rawInCount)
      ? (params.rawInCount as number)
      : params.fallbackInCount;

  const explicitOutputs = params.nodes.filter(
    (node) => String(node.type) === "subflowOutput",
  ).length;

  let nextOutCount =
    explicitOutputs > 0
      ? 1
      : Number.isFinite(params.rawOutCount)
        ? (params.rawOutCount as number)
        : params.fallbackOutCount;

  try {
    const computed = computeOpenPortsFromLookup(
      params.nodes,
      edgesForSave,
      params.lookup,
    );
    if (computed && computed.ready && explicitOutputs === 0) {
      nextOutCount = computed.outCount;
    }
  } catch {
    // ignore
  }

  try {
    const dangling = computeDanglingPortsFromLookup(
      params.nodes,
      edgesForSave,
      params.lookup,
    );
    const hasDanglingPorts =
      dangling.ready && (dangling.inCount > 0 || dangling.outCount > 0);
    if (hasDanglingPorts) {
      return {
        ok: false,
        error: messages.danglingPorts(dangling.inCount, dangling.outCount),
      };
    }
  } catch {
    // ignore
  }

  const hasEmptyInputs = params.nodes.some((node) => {
    if (String(node.type) !== "subflowInput") return false;
    const data = (node.data ?? {}) as Record<string, unknown>;
    const inputLabel = typeof data.label === "string" ? data.label : "";
    return !inputLabel.trim();
  });
  if (hasEmptyInputs) {
    return {
      ok: false,
      error: messages.emptyInputs,
    };
  }

  if (Number(nextOutCount) > 1) {
    return {
      ok: false,
      error: messages.tooManyOutputs,
    };
  }

  const finalLabel =
    (params.draftLabel || params.currentLabel).trim() || params.currentLabel;

  return {
    ok: true,
    finalLabel,
    nextInCount,
    nextOutCount,
    edgesForSave,
  };
}
