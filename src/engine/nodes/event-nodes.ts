import { FirePatterns, NodeDefinition } from "../program-elements";

export class EngineTimerNode extends NodeDefinition {
  constructor(intervalMs: number, mode: "delay" | "source" = "source") {
    const isDelayMode = mode === "delay";
    super(
      async (...args: unknown[]) => {
        const value = args.length > 0 ? args[0] : 0;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        return value;
      },
      isDelayMode ? [FirePatterns.EXISTS] : [FirePatterns.DONT_CARE],
      ["input", "output"],
      {
        skipStepDelay: true,
        allowParallelTokenExecutions: false,
      },
    );
  }
}
