import type { Node } from "@xyflow/react";

import type { NodeDefinition } from "../program-elements";

import type { NodeCompilerContext } from "./types";
import { compileInputNodes } from "./inputs";
import { compileProcessingNodes } from "./processing";
import { compileOutputNodes } from "./output";
import { compileLogicNodes } from "./logic";
import { compileListNodes } from "./list";
import { compileSubflowNodes } from "./subflow";

const compilers = [
  compileInputNodes,
  compileProcessingNodes,
  compileLogicNodes,
  compileListNodes,
  compileOutputNodes,
  compileSubflowNodes,
] as const;

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
