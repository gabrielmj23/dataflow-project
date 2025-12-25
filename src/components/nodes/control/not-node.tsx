import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";

export type NotNodeData = {
  label?: string;
};

export const NotNode = memo(({ data }: NodeProps) => {
  const { label = "NOT" } = (data ?? {}) as NotNodeData;

  return (
    <ControlRectNodeShell
      icon={<span className="text-sm font-bold">¬</span>}
      label={label}
      variant="singleInDualOut"
    />
  );
});

NotNode.displayName = "NotNode";
