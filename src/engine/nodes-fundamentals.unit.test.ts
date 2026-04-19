import { describe, expect, it } from "vitest";

import {
  EngineConcatNode,
  EngineDivideNode,
  EngineLogarithmNode,
  EnginePowerNode,
  EngineReplaceTextNode,
  EngineRootNode,
  EngineSliceTextNode,
  EngineSubtractTextNode,
  EngineSumNode,
} from "@/engine/nodes/algorithm-nodes";
import {
  EngineAndNode,
  EngineComparisonNode,
  EngineDesvioNode,
  EngineNotNode,
  EngineRelevoNode,
  EngineSwitchNode,
  EngineXorNode,
} from "@/engine/nodes/logic-nodes";

describe("fundamental arithmetic and text nodes", () => {
  it("evaluates sum", () => {
    const node = new EngineSumNode();
    expect(node.activationFunction(2, 3)).toBe(5);
  });

  it("throws on invalid divide", () => {
    const node = new EngineDivideNode();
    expect(() => node.activationFunction(8, 0)).toThrow();
  });

  it("throws on undefined 0^0", () => {
    const node = new EnginePowerNode();
    expect(() => node.activationFunction(0, 0)).toThrow();
  });

  it("throws on even root of negative number", () => {
    const node = new EngineRootNode();
    expect(() => node.activationFunction(-4, 2)).toThrow();
  });

  it("throws on invalid logarithm base", () => {
    const node = new EngineLogarithmNode();
    expect(() => node.activationFunction(10, 1)).toThrow();
  });

  it("concats and transforms text", () => {
    const concat = new EngineConcatNode();
    const replace = new EngineReplaceTextNode();
    const subtract = new EngineSubtractTextNode();
    const slice = new EngineSliceTextNode();

    expect(concat.activationFunction("hola", " mundo")).toBe("hola mundo");
    expect(replace.activationFunction("hola mundo", "mundo", "dataflow")).toBe(
      "hola dataflow",
    );
    expect(subtract.activationFunction("hola mundo", " mundo")).toBe("hola");
    expect(slice.activationFunction("abcdef", 1, 3)).toBe("bcd");
  });
});

describe("fundamental logic and control nodes", () => {
  it("evaluates logic operators", () => {
    const andNode = new EngineAndNode();
    const notNode = new EngineNotNode();
    const xorNode = new EngineXorNode();
    const cmpNode = new EngineComparisonNode(
      ">=" as "==" | "!=" | "<" | "<=" | ">" | ">=",
    );

    expect(andNode.activationFunction(true, false)).toBe(false);
    expect(notNode.activationFunction(true)).toBe(false);
    expect(xorNode.activationFunction(true, false)).toBe(true);
    expect(cmpNode.activationFunction(10, 10)).toBe(true);
  });

  it("routes switch output to first matching condition", () => {
    const node = new EngineSwitchNode([
      { operator: "contains", target: "abc" },
      { operator: "truthy" },
    ]);

    const output = node.activationFunction("abcde") as Array<{
      value: unknown;
      location: { portId: string };
    }>;

    expect(output).toHaveLength(1);
    expect(output[0]?.value).toBe("abcde");
    expect(output[0]?.location.portId).toBe("output1");
  });

  it("routes desvio and relevo outputs", () => {
    const desvio = new EngineDesvioNode();
    const relevo = new EngineRelevoNode();

    const desvioOutput = desvio.activationFunction("token", false) as Array<{
      value: unknown;
      location: { portId: string };
    }>;
    expect(desvioOutput[0]?.location.portId).toBe("output2");
    expect(desvioOutput[0]?.value).toBe("token");

    const relevoOutput = relevo.activationFunction("entrada", "rele") as Array<{
      value: unknown;
      location: { portId: string };
    }>;
    expect(relevoOutput[0]?.location.portId).toBe("output");
    expect(relevoOutput[0]?.value).toBe("rele");
  });
});
