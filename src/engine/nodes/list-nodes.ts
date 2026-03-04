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
      ["inputList", "outputList"],
      { skipStepDelay: true }
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
      ["inputList", "outputList"],
      { skipStepDelay: true }
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

export class EngineListFirstNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[]) => {
        const list = Array.isArray(inputList) ? inputList : [];
        if (list.length === 0) {
          throw new Error("La lista está vacía.");
        }
        return list[0];
      },
      [FirePatterns.EXISTS],
      ["inputList", "output"]
    );
  }
}

export class EngineListLastNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[]) => {
        const list = Array.isArray(inputList) ? inputList : [];
        if (list.length === 0) {
          throw new Error("La lista está vacía.");
        }
        return list[list.length - 1];
      },
      [FirePatterns.EXISTS],
      ["inputList", "output"]
    );
  }
}

export class EngineListAtPositionNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[], positionInput: unknown) => {
        const list = Array.isArray(inputList) ? inputList : [];
        if (list.length === 0) {
          throw new Error("La lista está vacía.");
        }

        const raw =
          typeof positionInput === "number"
            ? positionInput
            : Number(positionInput);

        if (!Number.isFinite(raw)) {
          throw new Error("La posición debe ser un número entero.");
        }

        const position = Math.floor(raw);
        if (position !== raw || position < 1) {
          throw new Error("La posición debe ser un entero mayor o igual a 1.");
        }

        const index = position - 1;
        if (index >= list.length) {
          throw new Error("La posición está fuera del rango de la lista.");
        }

        return list[index];
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["inputList", "position", "output"],
      { stickyInputPorts: ["inputList", "position"] }
    );
  }
}

export class EngineListFindElementNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[], item: unknown) => {
        const list = Array.isArray(inputList) ? inputList : [];
        const index = list.findIndex((entry) => entry === item);
        if (index < 0) return 0;
        return index + 1;
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["inputList", "item", "output"],
      { stickyInputPorts: ["inputList", "item"] }
    );
  }
}

export class EngineListRemoveFirstNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[]) => {
        const list = Array.isArray(inputList) ? inputList : [];
        if (list.length === 0) {
          return [];
        }
        return list.slice(1);
      },
      [FirePatterns.EXISTS],
      ["inputList", "outputList"]
    );
  }
}

export class EngineListRemoveLastNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[]) => {
        const list = Array.isArray(inputList) ? inputList : [];
        if (list.length === 0) {
          return [];
        }
        return list.slice(0, -1);
      },
      [FirePatterns.EXISTS],
      ["inputList", "outputList"]
    );
  }
}

export class EngineListPrependNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[], item: unknown) => {
        const list = Array.isArray(inputList) ? inputList : [];
        return [item, ...list];
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["inputList", "item", "outputList"],
      { stickyInputPorts: ["inputList", "item"] }
    );
  }
}

export class EngineListAppendNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[], item: unknown) => {
        const list = Array.isArray(inputList) ? inputList : [];
        return [...list, item];
      },
      [FirePatterns.EXISTS, FirePatterns.EXISTS],
      ["inputList", "item", "outputList"],
      { stickyInputPorts: ["inputList", "item"] }
    );
  }
}

export class EngineListIsEmptyNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[]) => {
        const list = Array.isArray(inputList) ? inputList : [];
        return list.length === 0;
      },
      [FirePatterns.EXISTS],
      ["inputList", "output"]
    );
  }
}

export class EngineListReverseNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[]) => {
        const list = Array.isArray(inputList) ? inputList : [];
        return [...list].reverse();
      },
      [FirePatterns.EXISTS],
      ["inputList", "outputList"]
    );
  }
}

export class EngineSplitListNode extends NodeDefinition {
  constructor() {
    super(
      (inputValue: unknown) => {
        if (typeof inputValue === "string") {
          return Array.from(inputValue);
        }

        if (typeof inputValue === "number") {
          if (!Number.isFinite(inputValue)) {
            throw new Error("El valor numérico no es válido.");
          }
          if (!Number.isInteger(inputValue) || inputValue < 0) {
            throw new Error(
              "Para números, Separar solo acepta enteros mayores o iguales a 0.",
            );
          }

          return String(inputValue).split("").map((digit) => Number(digit));
        }

        throw new Error("Separar solo acepta números o texto.");
      },
      [FirePatterns.EXISTS],
      ["inputValue", "outputList"],
    );
  }
}

export class EngineListEvenPositionsNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[]) => {
        const list = Array.isArray(inputList) ? inputList : [];

        return list.filter((_item, index) => {
          const position = index + 1;
          return position % 2 === 0;
        });
      },
      [FirePatterns.EXISTS],
      ["inputList", "outputList"],
    );
  }
}

export class EngineListOddPositionsNode extends NodeDefinition {
  constructor() {
    super(
      (inputList: unknown[]) => {
        const list = Array.isArray(inputList) ? inputList : [];

        return list.filter((_item, index) => {
          const position = index + 1;
          return position % 2 !== 0;
        });
      },
      [FirePatterns.EXISTS],
      ["inputList", "outputList"],
    );
  }
}

export class EngineSortListNode extends NodeDefinition {
  constructor(order: "asc" | "desc" = "asc") {
    super(
      (inputList: unknown[]) => {
        const list = Array.isArray(inputList) ? [...inputList] : [];
        const isNumeric = list.every(
          (item) => typeof item === "number" && Number.isFinite(item)
        );

        if (isNumeric) {
          const numericList = list as number[];
          return [...numericList].sort((a, b) =>
            order === "asc" ? a - b : b - a
          );
        }

        const decorated = list.map((value) => ({
          value,
          key: value == null ? "" : String(value),
        }));

        decorated.sort((a, b) =>
          order === "asc"
            ? a.key.localeCompare(b.key)
            : b.key.localeCompare(a.key)
        );

        return decorated.map((item) => item.value);
      },
      [FirePatterns.EXISTS],
      ["inputList", "outputList"]
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

export class EngineUnzipNode extends NodeDefinition {
  constructor() {
    super(
      (tuples: [number, number][]) => {
        const a: number[] = [];
        const b: number[] = [];
        for (const t of tuples ?? []) {
          if (Array.isArray(t) && t.length >= 2) {
            a.push(t[0]);
            b.push(t[1]);
          }
        }

        return [
          new DataToken<number[]>(a, new PortAddress("", "listA")),
          new DataToken<number[]>(b, new PortAddress("", "listB")),
        ];
      },
      [FirePatterns.EXISTS],
      ["inputList", "listA", "listB"]
    );
  }
}
