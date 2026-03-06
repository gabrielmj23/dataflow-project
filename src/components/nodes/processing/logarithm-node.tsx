import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const LogarithmNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="logarithm"
    icon={<span className="text-sm font-semibold leading-none">log</span>}
    defaultLabel="Logaritmo"
    configTitle="Configurar · Logaritmo"
  />
));

LogarithmNode.displayName = "LogarithmNode";
