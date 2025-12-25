import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Scale } from "lucide-react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";

export type ComparisonNodeData = {
  label?: string;
};

export const ComparisonNode = memo(({ data }: NodeProps) => {
  const { label = "Comparación" } = (data ?? {}) as ComparisonNodeData;

  return <ControlRectNodeShell icon={<Scale className="h-5 w-5" />} label={label} />;
});

ComparisonNode.displayName = "ComparisonNode";
