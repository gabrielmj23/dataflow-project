import { createContext, useContext } from "react";
import type { Edge, Node } from "@xyflow/react";

export type SubflowTemplatePayload = {
  id: string;
  name: string;
  inCount: number;
  outCount: number;
  nodes: Node[];
  edges: Edge[];
};

export type SubflowTemplateContextValue = {
  addOrUpdateTemplate: (payload: SubflowTemplatePayload) => void;
  isNameTaken: (name: string) => boolean;
};

export const SubflowTemplateContext =
  createContext<SubflowTemplateContextValue | null>(null);

export function useSubflowTemplateContext(): SubflowTemplateContextValue | null {
  return useContext(SubflowTemplateContext);
}
