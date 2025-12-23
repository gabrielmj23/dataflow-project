import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Timer } from "lucide-react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";

export type TimerInputNodeData = {
  label?: string;
};

export const TimerInputNode = memo(({ data }: NodeProps) => {
  const { label = "Timer" } = (data ?? {}) as TimerInputNodeData;

  return (
    <InputCircleNodeShell
      icon={<Timer className="h-7 w-7" />}
      label={label}
    />
  );
});

TimerInputNode.displayName = "TimerInputNode";
