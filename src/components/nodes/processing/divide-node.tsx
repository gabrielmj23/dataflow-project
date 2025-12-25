import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Divide } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type DivideNodeData = {
  label?: string;
};

export const DivideNode = memo(({ data }: NodeProps) => {
  const { label = "División" } = (data ?? {}) as DivideNodeData;

  return <ProcessingRectNodeShell icon={<Divide className="h-6 w-6" />} label={label} />;
});

DivideNode.displayName = "DivideNode";
