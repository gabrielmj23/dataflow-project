import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Link2 } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const ConcatNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="concat"
    icon={<Link2 className="h-5 w-5" />}
    defaultLabel="Concatenar"
    configTitle="Configurar · Concatenar"
  />
));

ConcatNode.displayName = "ConcatNode";
