import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type FilterNodeData = {
  label?: string;
};

export const FilterNode = memo(({ data }: NodeProps) => {
  const { label = "Filtrar" } = (data ?? {}) as FilterNodeData;

  return (
    <IterationRectNodeShell
      icon={<span className="text-lg font-bold">↓</span>}
      label={label}
      variant="singleInSingleOut"
    />
  );
});

FilterNode.displayName = "FilterNode";
