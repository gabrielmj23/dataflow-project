import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";

export type NandNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const NandNode = memo(({ data }: NodeProps) => {
  const { label = "NAND", runtimeError } = (data ?? {}) as NandNodeData;

  return (
    <ControlRectNodeShell
      nodeType="nand"
      icon={<span className="text-base font-bold">⊼</span>}
      label={label}
      runtimeError={runtimeError}
    />
  );
});

NandNode.displayName = "NandNode";
