import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowUp } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const CeilingNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="ceiling"
    inputCount={1}
    icon={<ArrowUp className="h-6 w-6" />}
    defaultLabel="Techo"
    configTitle="Configurar · Techo"
  />
));

CeilingNode.displayName = "CeilingNode";
