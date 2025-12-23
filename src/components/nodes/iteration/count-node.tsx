import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type CountNodeData = {
  label?: string;
};

export const CountNode = memo(({ data }: NodeProps) => {
  const { label = "Contar" } = (data ?? {}) as CountNodeData;

  return (
    <IterationRectNodeShell
      icon={<span className="text-lg font-bold">#</span>}
      label={label}
      variant="singleInSingleOut"
    />
  );
});

CountNode.displayName = "CountNode";
