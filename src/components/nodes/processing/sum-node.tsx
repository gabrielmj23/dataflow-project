import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const SumNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="sum"
    icon={<Plus className="h-6 w-6" />}
    defaultLabel="Sumar"
    configTitle="Configurar · Sumar"
  />
));

SumNode.displayName = "SumNode";
