import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";

export type SequenceNodeData = {
  label?: string;
};

export const SequenceNode = memo(({ data }: NodeProps) => {
  const { label = "Generar lista" } = (data ?? {}) as SequenceNodeData;

  return (
    <>
      <IterationRectNodeShell
        nodeType="sequence"
        icon={<span className="text-sm font-semibold">1..N</span>}
        label={label}
        variant="tripleInSingleOut"
      />
    </>
  );
});

SequenceNode.displayName = "SequenceNode";
