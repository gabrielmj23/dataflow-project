import { FirePatterns, NodeDefinition } from "../program-elements";

type ComparisonOperator = "==" | "!=" | "<" | "<=" | ">" | ">=";

export class EngineComparisonNode extends NodeDefinition {
  constructor(operator: ComparisonOperator) {
    let comparisonFunction: (a: unknown, b: unknown) => boolean;

    switch (operator) {
      case "==":
        comparisonFunction = (a, b) => a === b;
        break;
      case "!=":
        comparisonFunction = (a, b) => a !== b;
        break;
      case "<":
        comparisonFunction = (a, b) => (a as number) < (b as number);
        break;
      case "<=":
        comparisonFunction = (a, b) => (a as number) <= (b as number);
        break;
      case ">":
        comparisonFunction = (a, b) => (a as number) > (b as number);
        break;
      case ">=":
        comparisonFunction = (a, b) => (a as number) >= (b as number);
        break;
    }

    super(
      comparisonFunction,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"]
    );
  }
}

export class EngineNotNode extends NodeDefinition {
  constructor() {
    super((a: boolean) => !a, [FirePatterns.EXISTS], ["input", "output"]);
  }
}

export class EngineAndNode extends NodeDefinition {
  constructor() {
    super(
      (a: boolean, b: boolean) => a && b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"]
    );
  }
}

export class EngineOrNode extends NodeDefinition {
  constructor() {
    super(
      (a: boolean, b: boolean) => a || b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"]
    );
  }
}

/**
 * TODO: Revisar que el nodo funcione correctamente
 */
export class EngineSwitchNode extends NodeDefinition {
  constructor(condition: (value: unknown) => boolean | Promise<boolean>) {
    super(
      async (value: unknown) => Boolean(await condition(value)),
      [FirePatterns.EXISTS, FirePatterns.DONT_CARE, FirePatterns.DONT_CARE],
      ["value", "outputTrue", "outputFalse"]
    );
  }
}
