import { FirePatterns, NodeDefinition } from "../program-elements";

export class EngineConstantNode extends NodeDefinition {
  constructor(constantValue: number | string | boolean) {
    super(() => constantValue, [FirePatterns.ALWAYS], ["output"]);
  }
}

export class EngineRandomNode extends NodeDefinition {
  constructor(minValue: number, maxValue: number, integerOnly = false) {
    super(
      () => {
        if (!integerOnly) {
          return Math.random() * (maxValue - minValue) + minValue;
        }

        const minInt = Math.ceil(minValue);
        const maxInt = Math.floor(maxValue);
        if (minInt > maxInt) {
          return Number.NaN;
        }

        // Inclusive integer in [minInt, maxInt]
        return Math.floor(Math.random() * (maxInt - minInt + 1)) + minInt;
      },
      [FirePatterns.ALWAYS],
      ["output"]
    );
  }
}
