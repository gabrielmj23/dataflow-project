import { FirePatterns, NodeDefinition } from "../program-elements";

export class EngineSumNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => a + b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"]
    );
  }
}

export class EngineSubstractNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => a - b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"]
    );
  }
}

export class EngineMultiplyNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => a * b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"]
    );
  }
}

export class EngineDivideNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => a / b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"]
    );
  }
}

export class EngineModNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => a % b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"]
    );
  }
}

export class EnginePowerNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => Math.pow(a, b),
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"]
    );
  }
}

export class EngineConcatNode extends NodeDefinition {
  constructor() {
    super(
      (a: string, b: string) => a + b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"]
    );
  }
}
