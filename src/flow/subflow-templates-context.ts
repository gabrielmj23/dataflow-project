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

export type SubflowTemplateContextValue = {
  addOrUpdateTemplate: (payload: SubflowTemplatePayload) => void;
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
  /**
   * Validador opcional invocado al guardar la edición de un subflujo
   * (diálogo "Editar subflujo"). Si devuelve un `string`, el guardado se
   * cancela y el mensaje se muestra como error. Si devuelve `null`, procede.
   *
   * @param selfTemplateId   ID de la plantilla del subflujo que se está
   *   editando (puede ser `undefined` si el subflujo todavía no tiene id).
   * @param nodes            Nodos del interior del subflujo (draft).
   * @param edges            Aristas del interior del subflujo (draft).
   */
  onValidateSubflowEdit?: (
    selfTemplateId: string | undefined,
    nodes: Node[],
    edges: Edge[],
  ) => string | null;
};

export const SubflowTemplateContext =
  createContext<SubflowTemplateContextValue | null>(null);

export function useSubflowTemplateContext(): SubflowTemplateContextValue | null {
  return useContext(SubflowTemplateContext);
}
