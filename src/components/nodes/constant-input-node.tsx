import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { InputCircleNodeShell } from "@/components/nodes/input-circle-node-shell";

export type ConstantInputNodeData = {
  label?: string;
};

export const ConstantInputNode = memo(({ data }: NodeProps) => {
  const { label = "Constante" } = (data ?? {}) as ConstantInputNodeData;

  return (
    <InputCircleNodeShell
      icon={<span className="text-lg font-bold">C</span>}
      label={label}
    />
  );
});

ConstantInputNode.displayName = "ConstantInputNode";
