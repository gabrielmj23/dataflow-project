import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type ListOddPositionsNodeData = {
  label?: string;
};

export const ListOddPositionsNode = memo(({ data }: NodeProps) => {
  const { label = "Posiciones impares" } = (data ?? {}) as ListOddPositionsNodeData;

  return (
    <IterationRectNodeShell
      nodeType="listOddPositions"
      icon={<span className="text-sm font-medium leading-none">2n+1</span>}
      label={label}
      variant="singleInSingleOut"
    />
  );
});

ListOddPositionsNode.displayName = "ListOddPositionsNode";
