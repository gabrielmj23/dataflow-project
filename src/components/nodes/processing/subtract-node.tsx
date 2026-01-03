import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Minus } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type SubtractNodeData = {
  label?: string;
};

export const SubtractNode = memo(({ data }: NodeProps) => {
  const { label = "Restar" } = (data ?? {}) as SubtractNodeData;

  return (
    <ProcessingRectNodeShell
      nodeType="subtract"
      icon={<Minus className="h-6 w-6" />}
      label={label}
    />
  );
});

SubtractNode.displayName = "SubtractNode";
