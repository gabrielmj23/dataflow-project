import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Shuffle } from "lucide-react";

import { InputCircleNodeShell } from "@/components/nodes/input/input-circle-node-shell";

export type RandomInputNodeData = {
  label?: string;
};

export const RandomInputNode = memo(({ data }: NodeProps) => {
  const { label = "Valor Aleatorio" } = (data ?? {}) as RandomInputNodeData;

  return (
    <InputCircleNodeShell
      icon={<Shuffle className="size-6" />}
      label={label}
    />
  );
});

RandomInputNode.displayName = "RandomInputNode";
