import { describe, expect, it } from "vitest";

import { NODE_TYPES } from "@/common/constants";
import { mapHandleToPortId } from "@/engine/handle-mapping";

describe("handle mapping contracts", () => {
  it("maps sum handles to engine ports", () => {
    expect(
      mapHandleToPortId({
        nodeId: "sum-1",
        nodeType: NODE_TYPES.SUM_NODE,
        handleId: "in-1",
        direction: "target",
      }),
    ).toBe("input1");

    expect(
      mapHandleToPortId({
        nodeId: "sum-1",
        nodeType: NODE_TYPES.SUM_NODE,
        handleId: "out",
        direction: "source",
      }),
    ).toBe("output");
  });

  it("maps switch and desvio control handles", () => {
    expect(
      mapHandleToPortId({
        nodeId: "switch-1",
        nodeType: NODE_TYPES.SWITCH_NODE,
        handleId: "in",
        direction: "target",
      }),
    ).toBe("value");

    expect(
      mapHandleToPortId({
        nodeId: "switch-1",
        nodeType: NODE_TYPES.SWITCH_NODE,
        handleId: "out-2",
        direction: "source",
      }),
    ).toBe("output2");

    expect(
      mapHandleToPortId({
        nodeId: "desvio-1",
        nodeType: NODE_TYPES.DESVIO_NODE,
        handleId: "in-cond",
        direction: "target",
      }),
    ).toBe("condition");

    expect(
      mapHandleToPortId({
        nodeId: "desvio-1",
        nodeType: NODE_TYPES.DESVIO_NODE,
        handleId: "out-1",
        direction: "source",
      }),
    ).toBe("output1");
  });

  it("maps relevo relay input", () => {
    expect(
      mapHandleToPortId({
        nodeId: "relevo-1",
        nodeType: NODE_TYPES.RELEVO_NODE,
        handleId: "in-relay",
        direction: "target",
      }),
    ).toBe("relay");
  });

  it("throws for unknown handle", () => {
    expect(() =>
      mapHandleToPortId({
        nodeId: "sum-1",
        nodeType: NODE_TYPES.SUM_NODE,
        handleId: "in-3",
        direction: "target",
      }),
    ).toThrow("Unknown input handle");
  });
});
