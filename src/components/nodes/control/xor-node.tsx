import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";

export type XorNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const XorNode = memo(({ data }: NodeProps) => {
  const { label = "XOR", runtimeError } = (data ?? {}) as XorNodeData;

  return (
    <ControlRectNodeShell
      nodeType="xor"
      icon={<span className="text-base font-bold">⊕</span>}
      label={label}
      runtimeError={runtimeError}
    />
  );
});

XorNode.displayName = "XorNode";
