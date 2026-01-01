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
      (a: number, b: number) => {
        const result = a / b;
        if (!Number.isFinite(result)) {
          throw new Error("División no definida (dividir entre cero u otro caso inválido)");
        }
        return result;
      },
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
      (a: number, b: number) => {
        // En nuestro contexto, 0^0 se considera indefinido.
        if (a === 0 && b === 0) {
          throw new Error("Potencia no definida: 0^0 no está permitido");
        }

        const result = Math.pow(a, b);
        if (!Number.isFinite(result) || Number.isNaN(result)) {
          throw new Error("Potencia no definida para estos valores");
        }
        return result;
      },
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
