import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Minus } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const SubtractNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="subtract"
    icon={<Minus className="h-6 w-6" />}
    defaultLabel="Restar"
    configTitle="Configurar · Restar"
  />
));

SubtractNode.displayName = "SubtractNode";
