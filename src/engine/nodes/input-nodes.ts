import { FirePatterns, NodeDefinition } from "../program-elements";

export class EngineConstantNode extends NodeDefinition {
  constructor(constantValue: number | string | boolean) {
    super(() => constantValue, [FirePatterns.ALWAYS], ["output"]);
  }
}

export class EngineRandomNode extends NodeDefinition {
  constructor(minValue: number, maxValue: number) {
    super(
      () => Math.random() * (maxValue - minValue) + minValue,
      [FirePatterns.ALWAYS],
      ["output"]
    );
  }
}
