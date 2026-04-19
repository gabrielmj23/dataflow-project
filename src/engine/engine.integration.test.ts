import { describe, expect, it } from "vitest";

import { NODE_TYPES } from "@/common/constants";
import { makeEdge, makeNode } from "@/test-utils/flow-builders";
import { runFlowHeadless } from "@/test-utils/run-flow-headless";

function writePayloads(
  logs: Array<{ message: string; data?: unknown }>,
): string[] {
  return logs
    .filter((log) => log.message === "write")
    .map((log) => String(log.data ?? ""));
}

describe("engine integration", () => {
  it("runs arithmetic pipeline end-to-end", async () => {
    const nodes = [
      makeNode({
        id: "a",
        type: NODE_TYPES.CONSTANT_NUMBER_INPUT,
        data: { value: 2 },
      }),
      makeNode({
        id: "b",
        type: NODE_TYPES.CONSTANT_NUMBER_INPUT,
        data: { value: 3 },
      }),
      makeNode({ id: "sum", type: NODE_TYPES.SUM_NODE }),
      makeNode({
        id: "write",
        type: NODE_TYPES.WRITE_SINK,
        data: { template: "res={1}" },
      }),
    ];

    const edges = [
      makeEdge({ id: "e1", source: "a", target: "sum", targetHandle: "in-1" }),
      makeEdge({ id: "e2", source: "b", target: "sum", targetHandle: "in-2" }),
      makeEdge({
        id: "e3",
        source: "sum",
        sourceHandle: "out",
        target: "write",
      }),
    ];

    const result = await runFlowHeadless({ nodes, edges });
    const payloads = writePayloads(result.logs);

    expect(payloads).toContain("res=5");
    expect(result.nodeExecutions.some((event) => event.nodeId === "sum")).toBe(
      true,
    );
  });

  it("runs text pipeline end-to-end", async () => {
    const nodes = [
      makeNode({
        id: "left",
        type: NODE_TYPES.CONSTANT_TEXT_INPUT,
        data: { value: "hola" },
      }),
      makeNode({
        id: "right",
        type: NODE_TYPES.CONSTANT_TEXT_INPUT,
        data: { value: " mundo" },
      }),
      makeNode({ id: "concat", type: NODE_TYPES.CONCAT_NODE }),
      makeNode({
        id: "write",
        type: NODE_TYPES.WRITE_SINK,
        data: { template: "txt={1}" },
      }),
    ];

    const edges = [
      makeEdge({
        id: "e1",
        source: "left",
        target: "concat",
        targetHandle: "in-1",
      }),
      makeEdge({
        id: "e2",
        source: "right",
        target: "concat",
        targetHandle: "in-2",
      }),
      makeEdge({
        id: "e3",
        source: "concat",
        sourceHandle: "out",
        target: "write",
      }),
    ];

    const result = await runFlowHeadless({ nodes, edges });
    const payloads = writePayloads(result.logs);

    expect(payloads).toContain("txt=hola mundo");
    expect(
      result.nodeExecutions.some((event) => event.nodeId === "concat"),
    ).toBe(true);
  });

  it("runs control routing with desvio", async () => {
    const nodes = [
      makeNode({
        id: "value",
        type: NODE_TYPES.CONSTANT_TEXT_INPUT,
        data: { value: "token" },
      }),
      makeNode({
        id: "condition",
        type: NODE_TYPES.CONSTANT_BOOLEAN_INPUT,
        data: { value: false },
      }),
      makeNode({ id: "desvio", type: NODE_TYPES.DESVIO_NODE }),
      makeNode({
        id: "writeTrue",
        type: NODE_TYPES.WRITE_SINK,
        data: { template: "A={1}" },
      }),
      makeNode({
        id: "writeFalse",
        type: NODE_TYPES.WRITE_SINK,
        data: { template: "B={1}" },
      }),
    ];

    const edges = [
      makeEdge({
        id: "e1",
        source: "value",
        target: "desvio",
        targetHandle: "in",
      }),
      makeEdge({
        id: "e2",
        source: "condition",
        target: "desvio",
        targetHandle: "in-cond",
      }),
      makeEdge({
        id: "e3",
        source: "desvio",
        sourceHandle: "out-1",
        target: "writeTrue",
      }),
      makeEdge({
        id: "e4",
        source: "desvio",
        sourceHandle: "out-2",
        target: "writeFalse",
      }),
    ];

    const result = await runFlowHeadless({ nodes, edges });
    const payloads = writePayloads(result.logs);

    expect(payloads).toContain("B=token");
    expect(payloads).not.toContain("A=token");
  });
});
