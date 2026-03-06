import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const FloorNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="floor"
    inputCount={1}
    icon={<span className="text-sm font-normal leading-none">⎣ ⎦</span>}
    defaultLabel="Piso"
    configTitle="Configurar · Piso"
  />
));

FloorNode.displayName = "FloorNode";
