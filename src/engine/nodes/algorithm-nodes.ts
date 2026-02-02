import { FirePatterns, NodeDefinition } from "../program-elements";
import { evaluateFormulaExpression, validateFormula } from "@/utils/formula";

export class EngineSumNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => a + b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineSubstractNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => a - b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineMultiplyNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => a * b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineDivideNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => {
        const result = a / b;
        if (!Number.isFinite(result)) {
          throw new Error(
            "División no definida (dividir entre cero u otro caso inválido)",
          );
        }
        return result;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineModNode extends NodeDefinition {
  constructor() {
    super(
      (a: number, b: number) => a % b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        stickyInputPorts: ["input1", "input2"],
      },
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
      ["input1", "input2", "output"],
      {
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineConcatNode extends NodeDefinition {
  constructor() {
    super(
      (a: string, b: string) => a + b,
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["input1", "input2", "output"],
      {
        stickyInputPorts: ["input1", "input2"],
      },
    );
  }
}

export class EngineReplaceTextNode extends NodeDefinition {
  constructor() {
    super(
      (text: unknown, search: unknown, replacement: unknown) => {
        const source = String(text ?? "");
        const needle = String(search ?? "");
        if (needle.length === 0) return source;
        const repl = String(replacement ?? "");
        return source.split(needle).join(repl);
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["text", "search", "replacement", "output"],
      {
        stickyInputPorts: ["text", "search", "replacement"],
      },
    );
  }
}

export class EngineSubtractTextNode extends NodeDefinition {
  constructor() {
    super(
      (text: unknown, search: unknown) => {
        const source = String(text ?? "");
        const needle = String(search ?? "");
        if (needle.length === 0) return source;
        return source.split(needle).join("");
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["text", "search", "output"],
      {
        stickyInputPorts: ["text", "search"],
      },
    );
  }
}

export class EngineSliceTextNode extends NodeDefinition {
  constructor() {
    super(
      (text: unknown, start: unknown, end: unknown) => {
        const source = String(text ?? "");
        const len = source.length;

        const rawStart = Number(start);
        const rawEnd = Number(end);

        const s = Number.isFinite(rawStart)
          ? Math.max(0, Math.floor(rawStart))
          : 0;
        const e = Number.isFinite(rawEnd)
          ? Math.min(len, Math.floor(rawEnd) + 1)
          : len;

        const from = Math.min(len, Math.max(0, s));
        const to = Math.min(len, Math.max(from, e));

        return source.slice(from, to);
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["text", "start", "end", "output"],
      {
        stickyInputPorts: ["text", "start", "end"],
      },
    );
  }
}

export class EngineFloorNode extends NodeDefinition {
  constructor() {
    super(
      (a: number) => Math.floor(a),
      [FirePatterns.EXISTS],
      ["input1", "output"],
      {
        stickyInputPorts: ["input1"],
      },
    );
  }
}

export class EngineCeilingNode extends NodeDefinition {
  constructor() {
    super(
      (a: number) => Math.ceil(a),
      [FirePatterns.EXISTS],
      ["input1", "output"],
      {
        stickyInputPorts: ["input1"],
      },
    );
  }
}

export class EngineRoundNode extends NodeDefinition {
  constructor() {
    super(
      (a: number) => Math.round(a),
      [FirePatterns.EXISTS],
      ["input1", "output"],
      {
        stickyInputPorts: ["input1"],
      },
    );
  }
}

export class EngineFormulaNode extends NodeDefinition {
  constructor(params: { formula?: unknown; variables?: unknown }) {
    const rawFormula =
      typeof params.formula === "string" ? params.formula.trim() : "";
    const validation = validateFormula(rawFormula);

    const providedVariables = Array.isArray(params.variables)
      ? params.variables.filter(
          (value): value is string =>
            typeof value === "string" && value.trim() !== "",
        )
      : [];

    const effectiveVariables =
      providedVariables.length > 0 ? providedVariables : validation.variables;

    const inputPorts =
      effectiveVariables.length > 0
        ? effectiveVariables.map((_, index) => `input${index + 1}`)
        : ["input1"];

    const firePatterns = inputPorts.map(() => FirePatterns.EXISTS);
    const ports = [...inputPorts, "output"];
    const errorMessage =
      rawFormula === ""
        ? "Fórmula vacía."
        : validation.ok
          ? null
          : (validation.error ?? "Fórmula inválida.");

    const compiled = validation.compiled;

    super(
      (...args: unknown[]) => {
        if (errorMessage) {
          throw new Error(errorMessage);
        }
        if (!validation.ok || !compiled) {
          throw new Error(validation.error ?? "Fórmula inválida.");
        }

        const scope: Record<string, number> = {};
        for (let index = 0; index < effectiveVariables.length; index += 1) {
          const name = effectiveVariables[index] ?? `var${index + 1}`;
          const value = args[index];
          const numericValue = Number(value);
          if (!Number.isFinite(numericValue)) {
            throw new Error(`Entrada no numérica para ${name}.`);
          }
          scope[name] = numericValue;
        }

        try {
          return evaluateFormulaExpression({ compiled, scope });
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(error.message);
          }
          throw error;
        }
      },
      firePatterns,
      ports,
      {
        stickyInputPorts: inputPorts,
      },
    );
  }
}
