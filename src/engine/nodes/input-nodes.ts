import { FirePatterns, NodeDefinition } from "../program-elements";

export class EngineConstantNode extends NodeDefinition {
  constructor(constantValue: number | string | boolean) {
    super(() => constantValue, [FirePatterns.ALWAYS], ["output"], {
      skipStepDelay: true,
    });
  }
}

export class EngineConstantListNode extends NodeDefinition {
  constructor(items: Array<string | number>) {
    super(() => items.slice(), [FirePatterns.ALWAYS], ["output"], {
      skipStepDelay: true,
    });
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
      ["output"],
      { skipStepDelay: true }
    );
  }
}

export class EngineChoiceNode extends NodeDefinition {
  constructor(choices: string[]) {
    super(
      () => {
        if (!Array.isArray(choices) || choices.length === 0) return "";
        const idx = Math.floor(Math.random() * choices.length);
        return choices[idx];
      },
      [FirePatterns.ALWAYS],
      ["output"],
      { skipStepDelay: true }
    );
  }
}
