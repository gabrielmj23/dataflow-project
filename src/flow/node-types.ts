import { nodeTypesCore } from "@/flow/node-types-core";
import { SubflowNode } from "@/components/nodes/abstraction/subflow-node";

export const nodeTypes = {
  ...nodeTypesCore,
  subflow: SubflowNode,
};
