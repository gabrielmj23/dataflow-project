import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";

export type NotNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const NotNode = memo(({ data }: NodeProps) => {
  const { label = "NOT", runtimeError } = (data ?? {}) as NotNodeData;

  return (
    <ControlRectNodeShell
      icon={<span className="text-sm font-bold">¬</span>}
      label={label}
      variant="singleInSingleOut"
      runtimeError={runtimeError}
    />
  );
});

NotNode.displayName = "NotNode";
