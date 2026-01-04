import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";

export type OrNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const OrNode = memo(({ data }: NodeProps) => {
  const { label = "OR", runtimeError } = (data ?? {}) as OrNodeData;

  return (
    <ControlRectNodeShell
      nodeType="or"
      icon={<span className="text-sm font-bold">∨</span>}
      label={label}
      runtimeError={runtimeError}
    />
  );
});

OrNode.displayName = "OrNode";
