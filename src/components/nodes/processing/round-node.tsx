import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Circle } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type RoundNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const RoundNode = memo(({ data }: NodeProps) => {
  const { label = "Redondear", runtimeError } = (data ?? {}) as RoundNodeData;

  return (
    <ProcessingRectNodeShell
      nodeType="round"
      icon={<Circle className="h-6 w-6" />}
      label={label}
      runtimeError={runtimeError}
      inputCount={1}
    />
  );
});

RoundNode.displayName = "RoundNode";
