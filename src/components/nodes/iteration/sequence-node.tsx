import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type SequenceNodeData = {
  label?: string;
};

export const SequenceNode = memo(({ data }: NodeProps) => {
  const { label = "Generar Secuencia" } = (data ?? {}) as SequenceNodeData;

  return (
    <IterationRectNodeShell
      icon={<span className="text-sm font-bold">1..N</span>}
      label={label}
    />
  );
});

SequenceNode.displayName = "SequenceNode";
