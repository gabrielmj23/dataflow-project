import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type AccumulateNodeData = {
  label?: string;
};

export const AccumulateNode = memo(({ data }: NodeProps) => {
  const { label = "Acumular" } = (data ?? {}) as AccumulateNodeData;

  return (
    <IterationRectNodeShell
      nodeType="accumulate"
      icon={<span className="text-lg font-bold">Σ</span>}
      label={label}
      variant="singleInSingleOut"
    />
  );
});

AccumulateNode.displayName = "AccumulateNode";
