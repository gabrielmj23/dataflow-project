import { DataToken, FirePatterns, NodeDefinition, PortAddress } from "../program-elements";

export class EngineGenerateSequenceNode extends NodeDefinition {
  constructor(params?: {
    defaultStart?: number;
    defaultEnd?: number;
    defaultStep?: number;
    firePatterns?: [FirePatterns, FirePatterns, FirePatterns];
  }) {
    const defaultStart =
      typeof params?.defaultStart === "number" ? params.defaultStart : 1;
    const defaultEnd =
      typeof params?.defaultEnd === "number" ? params.defaultEnd : 10;
    const defaultStep =
      typeof params?.defaultStep === "number" && params.defaultStep > 0
        ? params.defaultStep
        : 1;
    const firePatterns: [FirePatterns, FirePatterns, FirePatterns] =
      params?.firePatterns ?? [
        FirePatterns.DONT_CARE,
        FirePatterns.DONT_CARE,
        FirePatterns.DONT_CARE,
      ];

    super(
      (startArg?: number, endArg?: number, stepArg?: number) => {
        const start = typeof startArg === "number" ? startArg : defaultStart;
        const end = typeof endArg === "number" ? endArg : defaultEnd;
        const stepRaw = typeof stepArg === "number" ? stepArg : defaultStep;
        const step = Number.isFinite(stepRaw) && stepRaw != 0 ? stepRaw : 1;

        if (start > end && step > 0) {
          throw new Error(
            "El valor de inicio no puede ser mayor que el valor de fin cuando el paso es positivo."
          );
        }
        if (start < end && step < 0) {
          throw new Error(
            "El valor de inicio no puede ser menor que el valor de fin cuando el paso es negativo."
          );
        }

        const sequence: number[] = [];
        for (let i = start; i <= end; i += step) {
          sequence.push(i);
        }
        return sequence;
      },
      [...firePatterns],
      ["start", "end", "step", "output"]
    );
  }
}

export class EnginePulseSequenceNode extends NodeDefinition {
  constructor(params?: {
    defaultStart?: number;
    defaultEnd?: number;
    defaultStep?: number;
    firePatterns?: [FirePatterns, FirePatterns, FirePatterns];
  }) {
    const defaultStart =
      typeof params?.defaultStart === "number" ? params.defaultStart : 1;
    const defaultEnd =
      typeof params?.defaultEnd === "number" ? params.defaultEnd : 10;
    const defaultStep =
      typeof params?.defaultStep === "number" && params.defaultStep > 0
        ? params.defaultStep
        : 1;
    const firePatterns: [FirePatterns, FirePatterns, FirePatterns] =
      params?.firePatterns ?? [
        FirePatterns.DONT_CARE,
        FirePatterns.DONT_CARE,
        FirePatterns.DONT_CARE,
      ];

    super(
      (startArg?: number, endArg?: number, stepArg?: number) => {
        const start = typeof startArg === "number" ? startArg : defaultStart;
        const end = typeof endArg === "number" ? endArg : defaultEnd;
        const stepRaw = typeof stepArg === "number" ? stepArg : defaultStep;
        const step = Number.isFinite(stepRaw) && stepRaw != 0 ? stepRaw : 1;

        if (start > end && step > 0) {
          throw new Error(
            "El valor de inicio no puede ser mayor que el valor de fin cuando el paso es positivo."
          );
        }
        if (start < end && step < 0) {
          throw new Error(
            "El valor de inicio no puede ser menor que el valor de fin cuando el paso es negativo."
          );
        }

        const pulses: DataToken<number>[] = [];
        for (let i = start; i <= end; i += step) {
          pulses.push(
            new DataToken<number>(i, new PortAddress("", "output"))
          );
        }
        return pulses;
      },
      [...firePatterns],
      ["start", "end", "step", "output"]
    );
  }
}

export class EngineFilterNode extends NodeDefinition {
  constructor(predicate: (item: unknown) => boolean | Promise<boolean>) {
    super(
      async (inputList: unknown[]) => {
        const out: unknown[] = [];
        for (const item of inputList) {
          if (await predicate(item)) {
            out.push(item);
          }
        }
        return out;
      },
      [FirePatterns.EXISTS],
      ["inputList", "outputList"]
    );
  }
}

export class EngineMapNode extends NodeDefinition {
  constructor(mapper: (item: unknown) => unknown | Promise<unknown>) {
    super(
      async (inputList: unknown[]) => {
        const out: unknown[] = [];
        for (const item of inputList) {
          out.push(await mapper(item));
        }
        return out;
      },
      [FirePatterns.EXISTS],
      ["inputList", "outputList"]
    );
  }
}

export class EngineReduceNode extends NodeDefinition {
  constructor(
    reducer: (accumulator: number, currentValue: number) => number,
    initialValue: number
  ) {
    super(
      (inputList: number[]) => inputList.reduce(reducer, initialValue),
      [FirePatterns.EXISTS],
      ["inputList", "output"]
    );
  }
}

export class EngineCountNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: number[]) => inputList.length,
      [FirePatterns.EXISTS],
      ["inputList", "output"]
    );
  }
}

export class EngineZipNode extends NodeDefinition {
  constructor() {
    super(
      (listA: number[], listB: number[]) => {
        const length = Math.min(listA.length, listB.length);
        const zipped: [number, number][] = [];
        for (let i = 0; i < length; i++) {
          zipped.push([listA[i], listB[i]]);
        }
        return zipped;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["listA", "listB", "output"]
    );
  }
}
