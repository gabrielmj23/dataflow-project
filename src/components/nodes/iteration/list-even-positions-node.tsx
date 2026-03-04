import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type ListEvenPositionsNodeData = {
  label?: string;
};

export const ListEvenPositionsNode = memo(({ data }: NodeProps) => {
  const { label = "Posiciones pares" } =
    (data ?? {}) as ListEvenPositionsNodeData;

  return (
    <IterationRectNodeShell
      nodeType="listEvenPositions"
      icon={<span className="text-sm font-medium leading-none">2n</span>}
      label={label}
      variant="singleInSingleOut"
    />
  );
});

ListEvenPositionsNode.displayName = "ListEvenPositionsNode";
