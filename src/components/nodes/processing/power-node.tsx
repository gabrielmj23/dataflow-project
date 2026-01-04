import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type PowerNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const PowerNode = memo(({ data }: NodeProps) => {
  const { label = "Potencia", runtimeError } = (data ?? {}) as PowerNodeData;

  return (
    <ProcessingRectNodeShell
      nodeType="power"
      icon={<span className="text-sm font-bold">x²</span>}
      label={label}
      runtimeError={runtimeError}
    />
  );
});

PowerNode.displayName = "PowerNode";
