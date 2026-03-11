import { FirePatterns, NodeDefinition } from "../program-elements";

export class EngineWriteNode extends NodeDefinition {
  constructor(
    inputCount = 1,
    template?: string,
    connectedInputPorts?: Iterable<string>,
  ) {
    const safeCount = Number.isFinite(inputCount)
      ? Math.max(1, Math.floor(inputCount))
      : 1;
    const connectedSet = new Set(connectedInputPorts ?? []);
    const hasConnectedPorts = connectedSet.size > 0;
    const inputPorts = Array.from(
      { length: safeCount },
      (_, i) => `input${i + 1}`,
    );

    super(
      () => {
        // Logging is surfaced via the engine observer.
        return undefined;
      },
      inputPorts.map((portId) =>
        hasConnectedPorts
          ? connectedSet.has(portId)
            ? FirePatterns.EXISTS
            : FirePatterns.DONT_CARE
          : FirePatterns.EXISTS,
      ),
      inputPorts,
      {
        kind: "write",
        template: typeof template === "string" ? template : undefined,
      },
    );
  }
}
