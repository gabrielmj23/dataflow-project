import { FirePatterns, NodeDefinition } from "../program-elements";

export class EngineGenerateSequenceNode extends NodeDefinition {
  constructor(start: number, end: number, step: number) {
    super(
      () => {
        const sequence: number[] = [];
        for (let i = start; i <= end; i += step) {
          sequence.push(i);
        }
        return sequence;
      },
      [FirePatterns.ALWAYS],
      ["output"]
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
