import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { X } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type MultiplyNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const MultiplyNode = memo(({ data }: NodeProps) => {
  const { label = "Multiplicar", runtimeError } = (data ?? {}) as MultiplyNodeData;

  return (
    <ProcessingRectNodeShell
      nodeType="multiply"
      icon={<X className="h-6 w-6" />}
      label={label}
      runtimeError={runtimeError}
    />
  );
});

MultiplyNode.displayName = "MultiplyNode";
