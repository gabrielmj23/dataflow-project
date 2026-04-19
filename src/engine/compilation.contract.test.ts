import { describe, expect, it } from "vitest";

import { NODE_TYPES } from "@/common/constants";
import { buildEngineStoresFromFlowGraph } from "@/engine/deserialize-program";
import { FirePatterns } from "@/engine/program-elements";
import { makeEdge, makeNode } from "@/test-utils/flow-builders";

describe("engine compilation contracts", () => {
  it("compiles sum node with expected ports and fire patterns", () => {
    const stores = buildEngineStoresFromFlowGraph({
      nodes: [makeNode({ id: "sum", type: NODE_TYPES.SUM_NODE })],
      edges: [],
    });

    const sumNode = stores.nodeStore.getNodeById("sum");
    expect(sumNode).toBeDefined();
    expect(sumNode?.nodeDefinition.ports).toEqual([
      "input1",
      "input2",
      "output",
    ]);
    expect(sumNode?.nodeDefinition.firePatterns).toEqual([
      FirePatterns.EXISTS,
      FirePatterns.EXISTS,
    ]);
  });

  it("compiles switch node with dynamic outputs", () => {
    const stores = buildEngineStoresFromFlowGraph({
      nodes: [
        makeNode({
          id: "switch",
          type: NODE_TYPES.SWITCH_NODE,
          data: {
            conditions: [
              { operator: "contains", target: "a" },
              { operator: "truthy" },
            ],
          },
        }),
      ],
      edges: [],
    });

    const sw = stores.nodeStore.getNodeById("switch");
    expect(sw?.nodeDefinition.ports).toEqual(["value", "output1", "output2"]);
    expect(sw?.nodeDefinition.firePatterns).toEqual([FirePatterns.EXISTS]);
  });

  it("compiles timer as source when it has no incoming edges", () => {
    const stores = buildEngineStoresFromFlowGraph({
      nodes: [
        makeNode({
          id: "timer",
          type: NODE_TYPES.TIMER_INPUT,
          data: { timeValue: 0.01 },
        }),
      ],
      edges: [],
    });

    const timer = stores.nodeStore.getNodeById("timer");
    expect(timer?.nodeDefinition.firePatterns).toEqual([
      FirePatterns.DONT_CARE,
    ]);
  });

  it("compiles timer as delay when it has incoming edges", () => {
    const stores = buildEngineStoresFromFlowGraph({
      nodes: [
        makeNode({
          id: "const",
          type: NODE_TYPES.CONSTANT_NUMBER_INPUT,
          data: { value: 1 },
        }),
        makeNode({
          id: "timer",
          type: NODE_TYPES.TIMER_INPUT,
          data: { timeValue: 0.01 },
        }),
      ],
      edges: [
        makeEdge({
          id: "e1",
          source: "const",
          target: "timer",
        }),
      ],
    });

    const timer = stores.nodeStore.getNodeById("timer");
    expect(timer?.nodeDefinition.firePatterns).toEqual([FirePatterns.EXISTS]);
  });
});
