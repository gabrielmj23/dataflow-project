import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const RootNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="root"
    icon={<span className="text-lg font-normal leading-none">√</span>}
    defaultLabel="Raíz"
    configTitle="Configurar · Raíz"
  />
));

RootNode.displayName = "RootNode";
