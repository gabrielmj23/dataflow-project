import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Replace } from "lucide-react";

import { ProcessingExecutionNode } from "@/components/nodes/processing/processing-execution-node";

export const ReplaceTextNode = memo((props: NodeProps) => (
  <ProcessingExecutionNode
    {...props}
    nodeType="replaceText"
    icon={<Replace className="h-5 w-5" />}
    defaultLabel="Reemplazar"
    configTitle="Configurar · Reemplazar"
    inputCount={3}
  />
));

ReplaceTextNode.displayName = "ReplaceTextNode";
