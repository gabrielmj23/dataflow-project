import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type PulseSequenceNodeData = {
  label?: string;
};

export const PulseSequenceNode = memo(({ data }: NodeProps) => {
  const { label = "Generar pulsos" } = (data ?? {}) as PulseSequenceNodeData;

  return (
    <IterationRectNodeShell
      nodeType="pulseSequence"
      icon={<span className="text-sm font-semibold">1..N</span>}
      label={label}
      variant="tripleInSingleOut"
    />
  );
});

PulseSequenceNode.displayName = "PulseSequenceNode";
