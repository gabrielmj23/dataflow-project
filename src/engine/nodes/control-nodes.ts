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
