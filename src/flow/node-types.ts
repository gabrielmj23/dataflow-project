import { nodeTypesCore } from "@/flow/node-types-core";
import { SubflowNode } from "@/components/nodes/abstraction/subflow-node";
import { NODE_TYPES } from "@/common/constants";
import { ReplicateFlowNode } from "@/components/nodes/distribution/replicate-flow-node";

export const nodeTypes = {
  ...nodeTypesCore,
  subflow: SubflowNode,
  [NODE_TYPES.REPLICATE_FLOW]: ReplicateFlowNode,
};
