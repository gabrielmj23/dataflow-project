import { FirePatterns, NodeDefinition } from "../program-elements";

export class EngineWriteNode extends NodeDefinition {
  constructor(inputCount = 1, template?: string) {
    const safeCount = Number.isFinite(inputCount)
      ? Math.max(1, Math.floor(inputCount))
      : 1;

    super(
      () => {
        // Logging is surfaced via the engine observer.
        return undefined;
      },
      Array.from({ length: safeCount }, () => FirePatterns.EXISTS),
      Array.from({ length: safeCount }, (_, i) => `input${i + 1}`),
      {
        kind: "write",
        template: typeof template === "string" ? template : undefined,
      },
    );
  }
}
