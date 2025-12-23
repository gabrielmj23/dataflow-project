import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type ZipNodeData = {
  label?: string;
};

export const ZipNode = memo(({ data }: NodeProps) => {
  const { label = "Zip" } = (data ?? {}) as ZipNodeData;

  return (
    <IterationRectNodeShell
      icon={<span className="text-sm font-bold">⇆</span>}
      label={label}
    />
  );
});

ZipNode.displayName = "ZipNode";
