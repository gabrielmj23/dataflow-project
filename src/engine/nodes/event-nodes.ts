import { FirePatterns, NodeDefinition } from "../program-elements";

export class EngineTimerNode extends NodeDefinition {
  constructor(intervalMs: number) {
    super(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        return Date.now();
      },
      [FirePatterns.ALWAYS],
      ["output"]
    );
  }
}
