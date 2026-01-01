import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ToggleRight } from "lucide-react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";

export type SwitchNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const SwitchNode = memo(({ data }: NodeProps) => {
  const { label = "Switch", runtimeError } = (data ?? {}) as SwitchNodeData;

  return (
    <ControlRectNodeShell
      icon={<ToggleRight className="h-5 w-5" />}
      label={label}
      variant="singleInDualOut"
      runtimeError={runtimeError}
    />
  );
});

SwitchNode.displayName = "SwitchNode";
