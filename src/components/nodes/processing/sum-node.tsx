import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type SumNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const SumNode = memo(({ data }: NodeProps) => {
  const { label = "Sumar", runtimeError } = (data ?? {}) as SumNodeData;

  return (
    <ProcessingRectNodeShell
      icon={<Plus className="h-6 w-6" />}
      label={label}
      runtimeError={runtimeError}
    />
  );
});

SumNode.displayName = "SumNode";
