import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type SplitListNodeData = {
  label?: string;
};

export const SplitListNode = memo(({ data }: NodeProps) => {
  const { label = "Separar" } = (data ?? {}) as SplitListNodeData;

  return (
    <IterationRectNodeShell
      nodeType="splitList"
      icon={<span className="text-sm font-medium">A→[]</span>}
      label={label}
      variant="singleInSingleOut"
    />
  );
});

SplitListNode.displayName = "SplitListNode";
