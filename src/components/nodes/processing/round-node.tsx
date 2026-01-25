import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Circle } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const RoundNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="round"
    icon={<Circle className="h-6 w-6" />}
    defaultLabel="Redondear"
    configTitle="Configurar · Redondear"
  />
));

RoundNode.displayName = "RoundNode";
