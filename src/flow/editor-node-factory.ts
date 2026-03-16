import type { Edge, Node } from "@xyflow/react";

import { NODE_TYPES } from "@/common/constants";
import { nodePalette } from "@/flow/node-palette";

export type ResolvedEditorSubflowTemplate = {
  id: string;
  name: string;
  authorName?: string;
  accentColor?: string;
  inCount: number;
  outCount: number;
  nodes: Node[];
  edges: Edge[];
};

export type ResolveEditorSubflowTemplate = (
  templateId: string,
) => ResolvedEditorSubflowTemplate | null;

export type FlowPositionProjector = {
  screenToFlowPosition?: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  project?: (pos: { x: number; y: number }) => {
    x: number;
    y: number;
  };
};

export function buildPaletteLabelLookup(): Map<string, string> {
  const map = new Map<string, string>();
  for (const category of nodePalette) {
    for (const item of category.items) {
      map.set(item.type, item.label);
    }
    if (category.subcategories) {
      for (const sub of category.subcategories) {
        for (const item of sub.items) {
          map.set(item.type, item.label);
        }
      }
    }
  }

  map.set("conditional", "Condicional");
  map.set("selector", "Selector");

  return map;
}

export const editorPaletteLabelByType = buildPaletteLabelLookup();

const REPLICATE_INPUT_NODE_ID = "replicate-input-value";
const REPLICATE_OUTPUT_NODE_ID = "replicate-output-value";

function buildDefaultReplicateFlowGraph() {
  const nodes: Node[] = [
    {
      id: REPLICATE_INPUT_NODE_ID,
      type: NODE_TYPES.REPLICATE_INPUT_VALUE,
      position: { x: 100, y: 40 },
      data: { label: "Lista de entrada" },
    },
    {
      id: REPLICATE_OUTPUT_NODE_ID,
      type: "subflowOutput",
      position: { x: 260, y: 0 },
      data: { label: "Salida" },
    },
  ];

  return {
    nodes,
    edges: [] as Edge[],
    inCount: 1,
    outCount: 1,
  };
}

export function projectClientToFlowPosition(
  instance: FlowPositionProjector | null | undefined,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const screenPos = { x: clientX, y: clientY };
  return (
    instance?.screenToFlowPosition?.(screenPos) ??
    instance?.project?.(screenPos) ?? { x: 0, y: 0 }
  );
}

export function buildDroppedNodeData(params: {
  type: string;
  templateId?: string | null;
  paletteLabelByType?: Map<string, string>;
  resolveSubflowTemplate?: ResolveEditorSubflowTemplate | null;
  includeTemplateAuthorName?: boolean;
  accentColor?: string;
}): Record<string, unknown> {
  const {
    type,
    templateId,
    paletteLabelByType = editorPaletteLabelByType,
    resolveSubflowTemplate,
    includeTemplateAuthorName = true,
    accentColor,
  } = params;

  const nodeLabel = paletteLabelByType.get(type);

  if (type === "subflow" && templateId && resolveSubflowTemplate) {
    const resolved = resolveSubflowTemplate(templateId);
    if (resolved) {
      return {
        label: resolved.name,
        ...(includeTemplateAuthorName
          ? { templateAuthorName: resolved.authorName }
          : {}),
        inCount: resolved.inCount,
        outCount: resolved.outCount,
        subflowNodes: resolved.nodes,
        subflowEdges: resolved.edges,
        templateId: resolved.id,
        accentColor: accentColor || resolved.accentColor,
      };
    }
  }

  if (type === NODE_TYPES.REPLICATE_FLOW) {
    const defaults = buildDefaultReplicateFlowGraph();
    return {
      ...(nodeLabel ? { label: nodeLabel } : {}),
      accentColor,
      subflowNodes: defaults.nodes,
      subflowEdges: defaults.edges,
      inCount: defaults.inCount,
      outCount: defaults.outCount,
    };
  }

  return nodeLabel ? { label: nodeLabel, accentColor } : { accentColor };
}

export function normalizeNodeTypeForEditor(
  type: Node["type"],
  availableNodeTypes: Record<string, unknown>,
): Node["type"] {
  if (!type) return type;

  const rawType = String(type);
  if (availableNodeTypes[rawType]) return rawType;

  const normalizedType = rawType.trim().toLowerCase();
  if (availableNodeTypes[normalizedType]) return normalizedType;

  return rawType;
}
