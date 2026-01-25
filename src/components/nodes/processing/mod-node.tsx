import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Percent } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const ModNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="mod"
    icon={<Percent className="h-6 w-6" />}
    defaultLabel="Módulo"
    configTitle="Configurar · Módulo"
  />
));

ModNode.displayName = "ModNode";
