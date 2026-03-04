import type { Edge, Node } from "@xyflow/react";

import { nodePalette } from "@/flow/node-palette";

export type ResolvedEditorSubflowTemplate = {
  id: string;
  name: string;
  authorName?: string;
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
  }
  return map;
}

export const editorPaletteLabelByType = buildPaletteLabelLookup();

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
}): Record<string, unknown> {
  const {
    type,
    templateId,
    paletteLabelByType = editorPaletteLabelByType,
    resolveSubflowTemplate,
    includeTemplateAuthorName = true,
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
      };
    }
  }

  return nodeLabel ? { label: nodeLabel } : {};
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
