import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowDown } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const FloorNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="floor"
    icon={<ArrowDown className="h-6 w-6" />}
    defaultLabel="Piso"
    configTitle="Configurar · Piso"
  />
));

FloorNode.displayName = "FloorNode";
