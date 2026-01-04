import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowDown } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type FloorNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const FloorNode = memo(({ data }: NodeProps) => {
  const { label = "Piso", runtimeError } = (data ?? {}) as FloorNodeData;

  return (
    <ProcessingRectNodeShell
      nodeType="floor"
      icon={<ArrowDown className="h-6 w-6" />}
      label={label}
      runtimeError={runtimeError}
      inputCount={1}
    />
  );
});

FloorNode.displayName = "FloorNode";
