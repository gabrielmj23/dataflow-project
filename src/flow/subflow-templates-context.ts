import { createContext, useContext } from "react";
import type { Edge, Node } from "@xyflow/react";

export type SubflowTemplatePayload = {
  id: string;
  name: string;
  authorName?: string;
  accentColor?: string;
  inCount: number;
  outCount: number;
  nodes: Node[];
  edges: Edge[];
};

export type GlobalSubflowUpdatePayload = {
  templateId?: string | null;
  previousLabel: string;
  nextLabel: string;
  inCount: number;
  outCount: number;
  nodes: Node[];
  edges: Edge[];
};

export type GlobalSubflowUpdateResult = {
  disconnected: boolean;
};

export type SubflowTemplateContextValue = {
  addOrUpdateTemplate: (payload: SubflowTemplatePayload) => void;
  applyGlobalSubflowUpdate: (
    payload: GlobalSubflowUpdatePayload,
  ) => GlobalSubflowUpdateResult;
  isNameTaken: (name: string) => boolean;
  resolveTemplate: (id: string) => {
    id: string;
    name: string;
    authorName?: string;
    accentColor?: string;
    inCount: number;
    outCount: number;
    nodes: Node[];
    edges: Edge[];
  } | null;
  resolveTemplateByName: (name: string) => {
    id: string;
    name: string;
    authorName?: string;
    accentColor?: string;
    inCount: number;
    outCount: number;
    nodes: Node[];
    edges: Edge[];
  } | null;
};

export const SubflowTemplateContext =
  createContext<SubflowTemplateContextValue | null>(null);

export function useSubflowTemplateContext(): SubflowTemplateContextValue | null {
  return useContext(SubflowTemplateContext);
}
