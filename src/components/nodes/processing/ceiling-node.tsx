import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const CeilingNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="ceiling"
    inputCount={1}
    icon={<span className="text-sm font-normal leading-none">⎡ ⎤</span>}
    defaultLabel="Techo"
    configTitle="Configurar · Techo"
  />
));

CeilingNode.displayName = "CeilingNode";
