import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type SumNodeData = {
  label?: string;
};

export const SumNode = memo(({ data }: NodeProps) => {
  const { label = "Sumar" } = (data ?? {}) as SumNodeData;

  return <ProcessingRectNodeShell icon={<Plus className="h-6 w-6" />} label={label} />;
});

SumNode.displayName = "SumNode";
