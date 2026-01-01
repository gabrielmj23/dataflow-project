import { FirePatterns, NodeDefinition } from "../program-elements";

export class EngineWriteNode extends NodeDefinition {
  constructor() {
    super(
      (data: unknown) => {
        console.log("EngineWriteNode output:", data);
        return data;
      },
      [FirePatterns.EXISTS],
      ["input"],
      { kind: "write" }
    );
  }
}
