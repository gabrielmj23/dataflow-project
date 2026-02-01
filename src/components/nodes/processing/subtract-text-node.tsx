import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Eraser } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const SubtractTextNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="subtractText"
    icon={<Eraser className="h-5 w-5" />}
    defaultLabel="Sustraer"
    configTitle="Configurar · Sustraer"
    inputCount={2}
  />
));

SubtractTextNode.displayName = "SubtractTextNode";
