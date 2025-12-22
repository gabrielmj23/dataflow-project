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
  constructor(predicate: (item: number) => boolean) {
    super(
      (inputList: number[]) => inputList.filter(predicate),
      [FirePatterns.EXISTS],
      ["inputList", "outputList"]
    );
  }
}

export class EngineMapNode extends NodeDefinition {
  constructor(mapper: (item: number) => number) {
    super(
      (inputList: number[]) => inputList.map(mapper),
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
