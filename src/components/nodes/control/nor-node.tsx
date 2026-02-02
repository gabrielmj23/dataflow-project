import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";

export type NorNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const NorNode = memo(({ data }: NodeProps) => {
  const { label = "NOR", runtimeError } = (data ?? {}) as NorNodeData;

  return (
    <ControlRectNodeShell
      nodeType="nor"
      icon={<span className="text-base font-bold">⊽</span>}
      label={label}
      runtimeError={runtimeError}
    />
  );
});

NorNode.displayName = "NorNode";
