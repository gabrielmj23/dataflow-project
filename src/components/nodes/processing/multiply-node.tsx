import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { X } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type MultiplyNodeData = {
  label?: string;
};

export const MultiplyNode = memo(({ data }: NodeProps) => {
  const { label = "Multiplicar" } = (data ?? {}) as MultiplyNodeData;

  return <ProcessingRectNodeShell icon={<X className="h-6 w-6" />} label={label} />;
});

MultiplyNode.displayName = "MultiplyNode";
