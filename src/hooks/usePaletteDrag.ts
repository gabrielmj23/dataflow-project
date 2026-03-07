import { useCallback, useMemo, useRef } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import {
  nodePalette,
  type NodePaletteCategory,
  type NodePaletteItem,
} from "@/flow/node-palette";
import {
  buildDroppedNodeData,
  editorPaletteLabelByType,
  projectClientToFlowPosition,
} from "@/flow/editor-node-factory";
import { createNodeId } from "@/utils/id";
import { playPop } from "@/lib/sound";
import type { FlowEdge, FlowNode } from "@/utils/flow";

type SubflowTemplate = {
  id: string;
  name: string;
  authorName?: string;
  ports: { inCount: number; outCount: number };
  snapshot: { nodes: FlowNode[]; edges: FlowEdge[] };
};

type UsePaletteDragParams = {
  reactFlowInstance: ReactFlowInstance | null;
  setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  setEdges: React.Dispatch<React.SetStateAction<FlowEdge[]>>;
  subflowTemplates: SubflowTemplate[];
};

export function usePaletteDrag({
  reactFlowInstance,
  setNodes,
  setEdges,
  subflowTemplates,
}: UsePaletteDragParams) {
  const draggingTypeRef = useRef<string | null>(null);

  const paletteLabelByType = editorPaletteLabelByType;

  const paletteCategories: NodePaletteCategory[] = useMemo(() => {
    return nodePalette;
  }, []);

  const onPaletteDragStart = useCallback(
    (event: React.DragEvent, item: NodePaletteItem) => {
      draggingTypeRef.current = item.type;
      event.dataTransfer.setData("application/reactflow", item.type);
      event.dataTransfer.effectAllowed = "move";

      if (item.templateId) {
        event.dataTransfer.setData(
          "application/subflow-template-id",
          item.templateId,
        );
      }

      const accentColor = (item as { accentColor?: string }).accentColor;
      if (accentColor) {
        event.dataTransfer.setData("application/accent-color", accentColor);
      }

      try {
        const buttonEl = event.currentTarget as unknown as HTMLElement | null;
        const previewEl = buttonEl?.querySelector<HTMLElement>(
          "[data-drag-preview]",
        );
        if (previewEl) {
          event.dataTransfer.setDragImage(
            previewEl,
            Math.round(previewEl.offsetWidth / 2),
            Math.round(previewEl.offsetHeight / 2),
          );
        }
      } catch {
        // ignore
      }
    },
    [],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type =
        event.dataTransfer.getData("application/reactflow") ||
        draggingTypeRef.current;
      if (!type) {
        return;
      }

      const templateIdRaw = event.dataTransfer.getData(
        "application/subflow-template-id",
      );
      const templateId = templateIdRaw || null;

      const accentColorRaw = event.dataTransfer.getData(
        "application/accent-color",
      );
      const accentColor = accentColorRaw || undefined;

      const position = projectClientToFlowPosition(
        reactFlowInstance,
        event.clientX,
        event.clientY,
      );

      let data = buildDroppedNodeData({
        type,
        templateId,
        accentColor,
        paletteLabelByType,
        resolveSubflowTemplate: (id) => {
          const template = subflowTemplates.find((tpl) => tpl.id === id);
          if (!template) return null;
          return {
            id: template.id,
            name: template.name,
            authorName: template.authorName,
            accentColor: (template as { accentColor?: string }).accentColor,
            inCount: template.ports.inCount,
            outCount: template.ports.outCount,
            nodes: template.snapshot.nodes,
            edges: template.snapshot.edges,
          };
        },
      });

      if (!(type === "subflow" && templateId)) {
        if (type === "write") {
          data = {
            ...(data ?? {}),
            inputCount: 1,
            template: "{1}",
          };
        }

        // Provide sensible defaults for common input/sequence nodes
        if (type === "constantInput") {
          data = {
            ...(data ?? {}),
            value: 0,
          };
        }
        if (type === "constantNumber") {
          data = {
            ...(data ?? {}),
            value: 0,
          };
        }
        if (type === "constantBoolean") {
          data = {
            ...(data ?? {}),
            value: true,
          };
        }
        if (type === "constantText") {
          data = {
            ...(data ?? {}),
            value: "texto",
          };
        }
        if (type === "constantList") {
          data = {
            ...(data ?? {}),
            items: ["1", "2", "3"],
            label: (data.label as string) ?? "Lista constante",
          };
        }
        if (type === "randomInput") {
          data = {
            ...(data ?? {}),
            min: 0,
            max: 100,
            integerOnly: false,
            label: (data.label as string) ?? "Valor Aleatorio",
          };
        }
        if (type === "choiceInput") {
          data = {
            ...(data ?? {}),
            choices: ["opción 1", "opción 2", "opción 3"],
            label: (data.label as string) ?? "Selección aleatoria",
          };
        }
        if (type === "sequence") {
          data = {
            ...(data ?? {}),
            min: 0,
            max: 100,
            step: 1,
            label: (data.label as string) ?? "Generar Secuencia",
          };
        }
      }

      if (type === "conditionalPair") {
        const conditionalId = createNodeId();
        const selectorId = createNodeId();

        const pairId = createNodeId();

        const conditionalNode: FlowNode = {
          id: conditionalId,
          type: "conditional",
          position,
          data: {
            label: "Condicional",
            pairId,
            pairRole: "conditional",
            pairOffsetY: 160,
          },
          selected: true,
        };

        const selectorNode: FlowNode = {
          id: selectorId,
          type: "selector",
          position: { x: position.x, y: position.y + 160 },
          data: {
            label: "Selector",
            pairId,
            pairRole: "selector",
            pairOffsetY: 160,
          },
          selected: false,
        };

        const edgeId = createNodeId();
        const edge: FlowEdge = {
          id: edgeId,
          source: conditionalId,
          sourceHandle: "out",
          target: selectorId,
          targetHandle: "token",
          type: "default",
          deletable: false,
          focusable: false,
          interactionWidth: 0,
          data: { edgeType: "straight", pairId, locked: true },
        };

        setNodes((prev) => {
          const cleared = prev.map((n) => ({ ...n, selected: false }));
          return [...cleared, conditionalNode, selectorNode];
        });
        setEdges((prev) => [...prev, edge]);
        // Play placement sound
        playPop();
        draggingTypeRef.current = null;
        return;
      }

      const newNode: FlowNode = {
        id: createNodeId(),
        type,
        position,
        data,
      };

      setNodes((prev) => {
        const cleared = prev.map((n) => ({ ...n, selected: false }));
        return [...cleared, { ...newNode, selected: true }];
      });
      // Play placement sound
      playPop();
      draggingTypeRef.current = null;
    },
    [
      paletteLabelByType,
      reactFlowInstance,
      setEdges,
      setNodes,
      subflowTemplates,
    ],
  );

  return {
    paletteCategories,
    onPaletteDragStart,
    onDragOver,
    onDrop,
  };
}
