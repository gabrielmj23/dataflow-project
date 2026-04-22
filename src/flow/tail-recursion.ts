import type { Edge, Node } from "@xyflow/react";
import { NODE_TYPES } from "@/common/constants";

/**
 * Resultado del análisis de recursión de cola de un subflujo.
 */
export type TailRecursionAnalysis = {
  /**
   * `true` si el subflujo usa exclusivamente recursión de cola.
   * `false` si al menos una llamada recursiva NO es de cola.
   * `null` si el subflujo no contiene ninguna llamada recursiva
   * (no es un subflujo recursivo).
   */
  isTailRecursive: boolean | null;

  /**
   * IDs de los nodos de subflujo recursivos que SÍ son de cola.
   */
  tailCallNodeIds: string[];

  /**
   * IDs de los nodos de subflujo recursivos que NO son de cola
   * (su resultado es procesado por otro nodo antes de salir).
   */
  nonTailCallNodeIds: string[];
};

/**
 * Detecta si un subflujo recursivo utiliza recursión de cola.
 *
 * **Definición de recursión de cola en este contexto:**
 * Un nodo de subflujo recursivo `R` (cuyo `templateId` pertenece al conjunto
 * `candidateTemplateIds`) realiza una **llamada de cola** si CADA uno de sus
 * puertos de salida conecta directamente a un nodo `subflowOutput` — es decir,
 * el valor producido por `R` no es procesado por ningún otro nodo antes de ser
 * devuelto.
 *
 * @param candidateTemplateIds  ID (o conjunto de IDs) de la plantilla del
 *   subflujo contenedor. Se acepta `string` por compatibilidad con la API
 *   antigua; internamente se normaliza a `Set<string>`.
 * @param nodes  Lista de nodos del interior del subflujo.
 * @param edges  Lista de aristas del interior del subflujo.
 */
export function analyzeTailRecursion(
  candidateTemplateIds: string | Set<string>,
  nodes: Node[],
  edges: Edge[],
): TailRecursionAnalysis {
  const templateIdSet: Set<string> =
    typeof candidateTemplateIds === "string"
      ? new Set([candidateTemplateIds])
      : candidateTemplateIds;
  // --- 1. Identificar el conjunto de nodos de salida ----------------------
  // Un nodo es "de salida" si su tipo es subflowOutput.
  const outputNodeIds = new Set<string>(
    nodes
      .filter((n) => String(n.type) === NODE_TYPES.SUBFLOW_OUTPUT)
      .map((n) => String(n.id)),
  );

  // --- 2. Identificar los nodos recursivos --------------------------------
  // Son nodos de tipo `subflow` cuyo `templateId` pertenece al conjunto de
  // candidatos (el nuevo id asignado O cualquier id de plantilla ya existente
  // que aparezca referenciada dentro del snapshot).
  const recursiveNodes = nodes.filter((n) => {
    if (String(n.type) !== NODE_TYPES.SUBFLOW) return false;
    const data =
      n.data && typeof n.data === "object"
        ? (n.data as Record<string, unknown>)
        : {};
    const nodeTemplateId = data.templateId;
    return (
      typeof nodeTemplateId === "string" &&
      templateIdSet.has(nodeTemplateId)
    );
  });

  if (recursiveNodes.length === 0) {
    // Sin llamadas recursivas → no es un subflujo recursivo.
    return {
      isTailRecursive: null,
      tailCallNodeIds: [],
      nonTailCallNodeIds: [],
    };
  }

  // --- 3. Construir un mapa de aristas por nodo fuente --------------------
  // sourceId → Set<targetId>
  const outgoingTargets = new Map<string, Set<string>>();
  for (const edge of edges) {
    const src = String(edge.source);
    const tgt = String(edge.target);
    if (!outgoingTargets.has(src)) {
      outgoingTargets.set(src, new Set());
    }
    outgoingTargets.get(src)!.add(tgt);
  }

  // --- 4. Clasificar cada nodo recursivo ----------------------------------
  const tailCallNodeIds: string[] = [];
  const nonTailCallNodeIds: string[] = [];

  for (const rNode of recursiveNodes) {
    const rId = String(rNode.id);
    const targets = outgoingTargets.get(rId) ?? new Set<string>();

    if (targets.size === 0) {
      // El nodo recursivo no tiene salidas conectadas.
      // No puede ser una llamada de cola válida porque su resultado nunca
      // alcanza una salida del subflujo.
      nonTailCallNodeIds.push(rId);
      continue;
    }

    // Una llamada es de cola ↔ TODOS los destinos directos son subflowOutput.
    const allTargetsAreOutput = [...targets].every((tId) =>
      outputNodeIds.has(tId),
    );

    if (allTargetsAreOutput) {
      tailCallNodeIds.push(rId);
    } else {
      nonTailCallNodeIds.push(rId);
    }
  }

  const isTailRecursive = nonTailCallNodeIds.length === 0;

  return { isTailRecursive, tailCallNodeIds, nonTailCallNodeIds };
}

/**
 * Variante simplificada que devuelve sólo un booleano (o `null`).
 *
 * - `true`  → el subflujo es tail-recursive.
 * - `false` → el subflujo es recursivo pero NO tail-recursive.
 * - `null`  → el subflujo no es recursivo (no se auto-llama).
 *
 * @param candidateTemplateIds  ID o conjunto de IDs del subflujo. Acepta
 *   `string` o `Set<string>` (ver `analyzeTailRecursion`).
 */
export function isTailRecursiveSubflow(
  candidateTemplateIds: string | Set<string>,
  nodes: Node[],
  edges: Edge[],
): boolean | null {
  return analyzeTailRecursion(candidateTemplateIds, nodes, edges).isTailRecursive;
}
