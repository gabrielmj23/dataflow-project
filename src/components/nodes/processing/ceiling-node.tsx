import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowUp } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type CeilingNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const CeilingNode = memo(({ data }: NodeProps) => {
  const { label = "Techo", runtimeError } = (data ?? {}) as CeilingNodeData;

  return (
    <ProcessingRectNodeShell
      nodeType="ceiling"
      icon={<ArrowUp className="h-6 w-6" />}
      label={label}
      runtimeError={runtimeError}
      inputCount={1}
    />
  );
});

CeilingNode.displayName = "CeilingNode";
