import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";

export type OrNodeData = {
  label?: string;
};

export const OrNode = memo(({ data }: NodeProps) => {
  const { label = "OR" } = (data ?? {}) as OrNodeData;

  return (
    <ControlRectNodeShell
      icon={<span className="text-sm font-bold">∨</span>}
      label={label}
    />
  );
});

OrNode.displayName = "OrNode";
