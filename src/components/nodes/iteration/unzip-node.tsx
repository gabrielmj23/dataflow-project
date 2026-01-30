import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type UnzipNodeData = {
  label?: string;
};

export const UnzipNode = memo(({ data }: NodeProps) => {
  const { label = "Unzip" } = (data ?? {}) as UnzipNodeData;

  return (
    <IterationRectNodeShell
      nodeType="unzip"
      icon={<span className="text-sm font-bold">⇅</span>}
      label={label}
      variant="singleInDoubleOut"
    />
  );
});

UnzipNode.displayName = "UnzipNode";
