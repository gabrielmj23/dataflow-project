import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { X } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const MultiplyNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="multiply"
    icon={<X className="h-6 w-6" />}
    defaultLabel="Multiplicar"
    configTitle="Configurar · Multiplicar"
  />
));

MultiplyNode.displayName = "MultiplyNode";
