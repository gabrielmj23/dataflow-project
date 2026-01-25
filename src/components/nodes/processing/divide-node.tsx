import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Divide } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const DivideNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="divide"
    icon={<Divide className="h-6 w-6" />}
    defaultLabel="Dividir"
    configTitle="Configurar · Dividir"
  />
));

DivideNode.displayName = "DivideNode";
