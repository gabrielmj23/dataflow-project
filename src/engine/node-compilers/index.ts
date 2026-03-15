import type { Node } from "@xyflow/react";

import type { NodeDefinition } from "../program-elements";

import type { NodeCompilerContext } from "./types";
import { compileInputNodes } from "./inputs";
import { compileProcessingNodes } from "./processing";
import { compileOutputNodes } from "./output";
import { compileLogicNodes } from "./logic";
import { compileListNodes } from "./list";
import { compileSubflowNodes } from "./subflow";
import { compileReplicateFlowNodes } from "./replicate-flow";

const compilers = [
  compileInputNodes,
  compileProcessingNodes,
  compileLogicNodes,
  compileListNodes,
  compileOutputNodes,
  compileReplicateFlowNodes,
  compileSubflowNodes,
] as const;

type NodeCompilerContextWithoutHelpers = Omit<NodeCompilerContext, "helpers">;

export class NodeDefinitionCompilerBuilder {
  private readonly context: Partial<NodeCompilerContextWithoutHelpers> = {};
  private helpers?: NodeCompilerContext["helpers"];

  withContext(context: NodeCompilerContextWithoutHelpers): this {
    Object.assign(this.context, context);
    return this;
  }

  withHelpers(helpers: NodeCompilerContext["helpers"]): this {
    this.helpers = helpers;
    return this;
  }

  build(): (flowNode: Node) => NodeDefinition {
    if (!this.helpers) {
      throw new Error("NodeDefinitionCompilerBuilder requires helpers.");
    }

    const compilerContext: NodeCompilerContext = {
      ...this.context,
      helpers: this.helpers,
    };

    return (flowNode: Node) => compileNodeDefinition(flowNode, compilerContext);
  }
}

export function tryCompileNodeDefinition(
  flowNode: Node,
  ctx: NodeCompilerContext,
): NodeDefinition | null {
  for (const compiler of compilers) {
    const def = compiler(flowNode, ctx);
    if (def) return def;
  }

  return null;
}

export function compileNodeDefinition(
  flowNode: Node,
  ctx: NodeCompilerContext,
): NodeDefinition {
  const def = tryCompileNodeDefinition(flowNode, ctx);
  if (def) return def;

  throw new Error(
    `Unsupported node type '${String(flowNode.type)}' for engine deserialization (node id: ${String(flowNode.id)}).`,
  );
}
