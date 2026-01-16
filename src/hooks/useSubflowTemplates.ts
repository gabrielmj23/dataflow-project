import { useCallback, useState } from "react";
import {
  type SubflowTemplatePayload,
} from "@/flow/subflow-templates-context";
import { type FlowEdge, type FlowNode, type SubflowSnapshot } from "@/utils/flow";

type SubflowPorts = { inCount: number; outCount: number };

type SavedSubflowTemplate = {
  id: string;
  name: string;
  ports: SubflowPorts;
  snapshot: SubflowSnapshot;
};

export function useSubflowTemplates() {
  const [subflowTemplates, setSubflowTemplates] = useState<
    SavedSubflowTemplate[]
  >([]);

  const addOrUpdateTemplate = useCallback((payload: SubflowTemplatePayload) => {
    setSubflowTemplates((prev) => {
      const nextTemplate: SavedSubflowTemplate = {
        id: payload.id,
        name: payload.name,
        ports: {
          inCount: payload.inCount,
          outCount: payload.outCount,
        },
        snapshot: {
          nodes: payload.nodes as FlowNode[],
          edges: payload.edges as FlowEdge[],
        },
      };

      const index = prev.findIndex((tpl) => tpl.id === payload.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = nextTemplate;
        return copy;
      }

      return [...prev, nextTemplate];
    });
  }, []);

  const isNameTaken = useCallback(
    (name: string) => {
      const normalized = name.trim().toLowerCase();
      if (!normalized) return false;
      return subflowTemplates.some(
        (tpl) => tpl.name.trim().toLowerCase() === normalized
      );
    },
    [subflowTemplates]
  );

  const resolveTemplate = useCallback(
    (id: string) => {
      const tpl = subflowTemplates.find((t) => t.id === id);
      if (!tpl) return null;
      return {
        id: tpl.id,
        name: tpl.name,
        inCount: tpl.ports.inCount,
        outCount: tpl.ports.outCount,
        nodes: tpl.snapshot.nodes,
        edges: tpl.snapshot.edges,
      };
    },
    [subflowTemplates]
  );

  const deleteTemplate = useCallback((id: string) => {
    setSubflowTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
  }, []);

  return {
    subflowTemplates,
    addOrUpdateTemplate,
    isNameTaken,
    resolveTemplate,
    deleteTemplate,
  };
}
