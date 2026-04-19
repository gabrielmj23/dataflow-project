import { describe, expect, it } from "vitest";
import { makeEdge, makeNode } from "@/test-utils/flow-builders";
import { NODE_TYPES } from "@/common/constants";
import { analyzeTailRecursion, isTailRecursiveSubflow } from "./tail-recursion";

// ---------------------------------------------------------------------------
// Helpers de construcción
// ---------------------------------------------------------------------------

const TEMPLATE_ID = "my-recursive-subflow";

/**
 * Crea un nodo de tipo subflow que se auto-referencia (llamada recursiva).
 */
function makeRecursiveCallNode(id: string, templateId = TEMPLATE_ID) {
  return makeNode({
    id,
    type: NODE_TYPES.SUBFLOW,
    data: { templateId },
  });
}

/**
 * Crea un nodo de tipo subflow que apunta a OTRA plantilla (no recursivo).
 */
function makeExternalSubflowNode(id: string) {
  return makeNode({
    id,
    type: NODE_TYPES.SUBFLOW,
    data: { templateId: "some-other-template" },
  });
}

function makeOutputNode(id: string) {
  return makeNode({ id, type: NODE_TYPES.SUBFLOW_OUTPUT });
}

function makeInputNode(id: string) {
  return makeNode({ id, type: NODE_TYPES.SUBFLOW_INPUT });
}

function makeSumNode(id: string) {
  return makeNode({ id, type: NODE_TYPES.SUM_NODE });
}

// ---------------------------------------------------------------------------
// Escenario 1 – Sin llamadas recursivas
// ---------------------------------------------------------------------------
describe("analyzeTailRecursion – sin recursión", () => {
  it("devuelve isTailRecursive=null cuando no hay nodos recursivos", () => {
    const nodes = [
      makeInputNode("in"),
      makeSumNode("sum"),
      makeOutputNode("out"),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "in", target: "sum" }),
      makeEdge({ id: "e2", source: "sum", target: "out" }),
    ];

    const result = analyzeTailRecursion(TEMPLATE_ID, nodes, edges);
    expect(result.isTailRecursive).toBeNull();
    expect(result.tailCallNodeIds).toHaveLength(0);
    expect(result.nonTailCallNodeIds).toHaveLength(0);
  });

  it("ignora subflujos que apuntan a otra plantilla", () => {
    const nodes = [
      makeInputNode("in"),
      makeExternalSubflowNode("ext"),
      makeOutputNode("out"),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "in", target: "ext" }),
      makeEdge({ id: "e2", source: "ext", target: "out" }),
    ];

    const result = analyzeTailRecursion(TEMPLATE_ID, nodes, edges);
    expect(result.isTailRecursive).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Escenario 2 – Recursión de cola pura
// ---------------------------------------------------------------------------
describe("analyzeTailRecursion – recursión de cola pura", () => {
  it("detecta llamada de cola cuando el nodo recursivo conecta directo a subflowOutput", () => {
    // Estructura: input → rec → subflowOutput
    const nodes = [
      makeInputNode("in"),
      makeRecursiveCallNode("rec"),
      makeOutputNode("out"),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "in", target: "rec" }),
      makeEdge({ id: "e2", source: "rec", target: "out" }),
    ];

    const result = analyzeTailRecursion(TEMPLATE_ID, nodes, edges);
    expect(result.isTailRecursive).toBe(true);
    expect(result.tailCallNodeIds).toContain("rec");
    expect(result.nonTailCallNodeIds).toHaveLength(0);
  });

  it("detecta múltiples nodos recursivos de cola (ej. ramas distintas)", () => {
    // Dos ramas independientes, cada una con su llamada recursiva de cola.
    const nodes = [
      makeInputNode("in"),
      makeRecursiveCallNode("rec1"),
      makeRecursiveCallNode("rec2"),
      makeOutputNode("out"),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "in", target: "rec1" }),
      makeEdge({ id: "e2", source: "in", target: "rec2" }),
      makeEdge({ id: "e3", source: "rec1", target: "out" }),
      makeEdge({ id: "e4", source: "rec2", target: "out" }),
    ];

    const result = analyzeTailRecursion(TEMPLATE_ID, nodes, edges);
    expect(result.isTailRecursive).toBe(true);
    expect(result.tailCallNodeIds).toContain("rec1");
    expect(result.tailCallNodeIds).toContain("rec2");
    expect(result.nonTailCallNodeIds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Escenario 3 – Recursión NO de cola
// ---------------------------------------------------------------------------
describe("analyzeTailRecursion – recursión NO de cola", () => {
  it("detecta cuando el resultado recursivo pasa por otro nodo antes de salir", () => {
    // Estructura: input → rec → sum → subflowOutput
    //                      ↑
    //                    (aquí sum transforma el resultado de rec)
    const nodes = [
      makeInputNode("in"),
      makeRecursiveCallNode("rec"),
      makeSumNode("sum"),
      makeOutputNode("out"),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "in", target: "rec" }),
      makeEdge({ id: "e2", source: "rec", target: "sum" }),
      makeEdge({ id: "e3", source: "sum", target: "out" }),
    ];

    const result = analyzeTailRecursion(TEMPLATE_ID, nodes, edges);
    expect(result.isTailRecursive).toBe(false);
    expect(result.nonTailCallNodeIds).toContain("rec");
    expect(result.tailCallNodeIds).toHaveLength(0);
  });

  it("detecta cuando el nodo recursivo no tiene salidas conectadas", () => {
    const nodes = [makeInputNode("in"), makeRecursiveCallNode("rec")];
    const edges = [makeEdge({ id: "e1", source: "in", target: "rec" })];

    const result = analyzeTailRecursion(TEMPLATE_ID, nodes, edges);
    expect(result.isTailRecursive).toBe(false);
    expect(result.nonTailCallNodeIds).toContain("rec");
  });

  it("detecta recursión mixta: una llamada de cola y una no de cola", () => {
    // rec1 es de cola (→ out), rec2 no lo es (→ sum → out)
    const nodes = [
      makeInputNode("in"),
      makeRecursiveCallNode("rec1"),
      makeRecursiveCallNode("rec2"),
      makeSumNode("sum"),
      makeOutputNode("out"),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "in", target: "rec1" }),
      makeEdge({ id: "e2", source: "in", target: "rec2" }),
      makeEdge({ id: "e3", source: "rec1", target: "out" }),
      makeEdge({ id: "e4", source: "rec2", target: "sum" }),
      makeEdge({ id: "e5", source: "sum", target: "out" }),
    ];

    const result = analyzeTailRecursion(TEMPLATE_ID, nodes, edges);
    expect(result.isTailRecursive).toBe(false);
    expect(result.tailCallNodeIds).toContain("rec1");
    expect(result.nonTailCallNodeIds).toContain("rec2");
  });
});

// ---------------------------------------------------------------------------
// Escenario 4 – isTailRecursiveSubflow (wrapper)
// ---------------------------------------------------------------------------
describe("isTailRecursiveSubflow", () => {
  it("devuelve null cuando no hay recursión", () => {
    const nodes = [makeInputNode("in"), makeOutputNode("out")];
    const edges = [makeEdge({ id: "e1", source: "in", target: "out" })];
    expect(isTailRecursiveSubflow(TEMPLATE_ID, nodes, edges)).toBeNull();
  });

  it("devuelve true cuando es tail-recursive", () => {
    const nodes = [
      makeInputNode("in"),
      makeRecursiveCallNode("rec"),
      makeOutputNode("out"),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "in", target: "rec" }),
      makeEdge({ id: "e2", source: "rec", target: "out" }),
    ];
    expect(isTailRecursiveSubflow(TEMPLATE_ID, nodes, edges)).toBe(true);
  });

  it("devuelve false cuando no es tail-recursive", () => {
    const nodes = [
      makeInputNode("in"),
      makeRecursiveCallNode("rec"),
      makeSumNode("sum"),
      makeOutputNode("out"),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "in", target: "rec" }),
      makeEdge({ id: "e2", source: "rec", target: "sum" }),
      makeEdge({ id: "e3", source: "sum", target: "out" }),
    ];
    expect(isTailRecursiveSubflow(TEMPLATE_ID, nodes, edges)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Escenario 5 – Regresión: templateId interno ≠ nuevo templateId (bug real)
// ---------------------------------------------------------------------------
describe("analyzeTailRecursion – regresión templateId desajustado", () => {
  /**
   * Escenario del bug reportado:
   * - Plantilla existente "Factorial" tiene id "sf-1".
   * - Al guardar, la nueva plantilla recibe id "sf-2".
   * - El nodo recursivo interno tiene templateId "sf-1", NO "sf-2".
   * - Con la API antigua (string solo) analyzeTailRecursion("sf-2") devolvía null (bug).
   * - Con el Set de candidatos {"sf-1","sf-2"} detecta correctamente la no-tail-recursión.
   */
  it("con Set detecta NO tail-recursión aunque el nodo use el id antiguo (sf-1)", () => {
    const EXISTING_ID = "sf-1";
    const NEW_ID = "sf-2";
    const candidates = new Set([EXISTING_ID, NEW_ID]);

    const nodes = [
      makeInputNode("in"),
      makeRecursiveCallNode("rec", EXISTING_ID),
      makeSumNode("sum"),
      makeOutputNode("out"),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "in", target: "rec" }),
      makeEdge({ id: "e2", source: "rec", target: "sum" }),
      makeEdge({ id: "e3", source: "sum", target: "out" }),
    ];

    // Comportamiento antiguo (roto): devuelve null
    expect(analyzeTailRecursion(NEW_ID, nodes, edges).isTailRecursive).toBeNull();

    // Comportamiento corregido: detecta false
    const fixed = analyzeTailRecursion(candidates, nodes, edges);
    expect(fixed.isTailRecursive).toBe(false);
    expect(fixed.nonTailCallNodeIds).toContain("rec");
  });

  it("con Set acepta tail-recursión cuando el nodo (sf-1) conecta directo a salida", () => {
    const candidates = new Set(["sf-1", "sf-2"]);
    const nodes = [
      makeInputNode("in"),
      makeRecursiveCallNode("rec", "sf-1"),
      makeOutputNode("out"),
    ];
    const edges = [
      makeEdge({ id: "e1", source: "in", target: "rec" }),
      makeEdge({ id: "e2", source: "rec", target: "out" }),
    ];

    const result = analyzeTailRecursion(candidates, nodes, edges);
    expect(result.isTailRecursive).toBe(true);
    expect(result.tailCallNodeIds).toContain("rec");
  });
});
