import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const PowerNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="power"
    icon={<span className="text-lg font-normal leading-none">x²</span>}
    defaultLabel="Potencia"
    configTitle="Configurar · Potencia"
  />
));

PowerNode.displayName = "PowerNode";
