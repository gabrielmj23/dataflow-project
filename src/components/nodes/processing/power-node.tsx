import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type PowerNodeData = {
  label?: string;
};

export const PowerNode = memo(({ data }: NodeProps) => {
  const { label = "Potencia" } = (data ?? {}) as PowerNodeData;

  return (
    <ProcessingRectNodeShell
      icon={<span className="text-sm font-bold">x²</span>}
      label={label}
    />
  );
});

PowerNode.displayName = "PowerNode";
