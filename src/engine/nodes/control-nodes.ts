import {
  DataToken,
  FirePatterns,
  NodeDefinition,
  PortAddress,
} from "../program-elements";

export class EngineScatterNode extends NodeDefinition {
  constructor(params?: { outputCount?: number }) {
    const safeCount = Math.max(0, Math.floor(params?.outputCount ?? 0));
    const outputPorts = Array.from(
      { length: safeCount },
      (_v, index) => `output${index + 1}`,
    );

    super(
      (inputList: unknown[]) => {
        if (outputPorts.length === 0) return [];

        const values = Array.isArray(inputList) ? inputList : [];
        const len = values.length;
        const n = outputPorts.length;
        const buckets: unknown[][] = Array.from({ length: n }, () => []);

        // Distribuir en chunks lo más equitativamente posible
        for (let i = 0; i < n; i += 1) {
          const start = Math.floor((i * len) / n);
          const end = Math.floor(((i + 1) * len) / n);
          buckets[i] = values.slice(start, end);
        }

        return outputPorts.map(
          (portId, index) =>
            new DataToken(buckets[index] ?? [], new PortAddress("", portId)),
        );
      },
      [FirePatterns.EXISTS],
      ["inputList", ...outputPorts],
    );
  }
}

export class EngineGatherNode extends NodeDefinition {
  constructor(params?: { inputCount?: number; firePatterns?: FirePatterns[] }) {
    const safeCount = Math.max(0, Math.floor(params?.inputCount ?? 0));
    const inputPorts = Array.from(
      { length: safeCount },
      (_v, index) => `input${index + 1}`,
    );

    const patterns =
      params?.firePatterns && params.firePatterns.length === inputPorts.length
        ? params.firePatterns
        : inputPorts.map(() => FirePatterns.EXISTS);

    super(
      (...args: unknown[]) => {
        const result: unknown[] = [];
        for (const value of args) {
          if (Array.isArray(value)) {
            result.push(...value);
          } else if (value !== undefined) {
            result.push(value);
          }
        }
        return result;
      },
      patterns,
      [...inputPorts, "outputList"],
    );
  }
}

export class EngineBarrierNode extends NodeDefinition {
  constructor(params?: { portCount?: number; firePatterns?: FirePatterns[] }) {
    const safeCount = Math.max(1, Math.floor(params?.portCount ?? 1));
    const inputPorts = Array.from(
      { length: safeCount },
      (_v, index) => `input${index + 1}`,
    );
    const outputPorts = Array.from(
      { length: safeCount },
      (_v, index) => `output${index + 1}`,
    );

    const patterns =
      params?.firePatterns && params.firePatterns.length === inputPorts.length
        ? params.firePatterns
        : inputPorts.map(() => FirePatterns.EXISTS);

    super(
      (...args: unknown[]) =>
        args.map(
          (value, index) =>
            new DataToken(value, new PortAddress("", outputPorts[index] ?? "")),
        ),
      patterns,
      [...inputPorts, ...outputPorts],
    );
  }
}
