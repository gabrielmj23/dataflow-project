import { describe, expect, it } from "vitest";

import { NODE_TYPES } from "@/common/constants";
import { validateConnection } from "@/flow/connection-validation";
import { deserializeProgram, serializeProgram } from "@/flow/serialization";
import { makeEdge, makeNode } from "@/test-utils/flow-builders";

describe("flow serialization contracts", () => {
  it("preserves ids, data and handles on round-trip", () => {
    const nodes = [
      makeNode({
        id: "n1",
        type: NODE_TYPES.CONSTANT_NUMBER_INPUT,
        data: { value: 7, label: "A" },
        position: { x: 12, y: 34 },
      }),
      makeNode({
        id: "n2",
        type: NODE_TYPES.SUM_NODE,
        data: { label: "Suma" },
        position: { x: 100, y: 100 },
      }),
    ];

    const edges = [
      makeEdge({
        id: "e1",
        source: "n1",
        target: "n2",
        targetHandle: "in-1",
      }),
    ];

    const serialized = serializeProgram({ nodes, edges }, false);
    const restored = deserializeProgram(serialized);

    expect(restored.nodes).toHaveLength(2);
    expect(restored.edges).toHaveLength(1);
    expect(restored.edges[0]?.targetHandle).toBe("in-1");
    expect(
      (
        restored.nodes.find((node) => node.id === "n1")?.data as {
          value?: unknown;
        }
      )?.value,
    ).toBe(7);
  });

  it("filters invalid edges during deserialize", () => {
    const nodes = [
      makeNode({
        id: "txt",
        type: NODE_TYPES.CONSTANT_TEXT_INPUT,
        data: { value: "hola" },
      }),
      makeNode({ id: "sum", type: NODE_TYPES.SUM_NODE }),
    ];

    const edges = [
      makeEdge({
        id: "invalid-type-edge",
        source: "txt",
        target: "sum",
        targetHandle: "in-1",
      }),
    ];

    const serialized = serializeProgram({ nodes, edges }, false);
    const restored = deserializeProgram(serialized);

    expect(restored.edges).toHaveLength(0);
  });

  it("rejects conditional-selector links when pair ids mismatch", () => {
    const nodes = [
      makeNode({
        id: "cond",
        type: NODE_TYPES.CONDITIONAL_NODE,
        data: { pairId: "pair-a" },
      }),
      makeNode({
        id: "selector",
        type: NODE_TYPES.CONDITIONAL_SELECTOR_NODE,
        data: { pairId: "pair-b" },
      }),
    ];

    const edge = makeEdge({
      id: "pair-mismatch",
      source: "cond",
      sourceHandle: "out",
      target: "selector",
      targetHandle: "token",
    });

    const result = validateConnection(nodes, edge);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("mismo par");
  });
});
