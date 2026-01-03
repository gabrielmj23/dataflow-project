import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Link2 } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type ConcatNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const ConcatNode = memo(({ data }: NodeProps) => {
  const { label = "Concatenar", runtimeError } = (data ?? {}) as ConcatNodeData;

  return (
    <ProcessingRectNodeShell
      nodeType="concat"
      icon={<Link2 className="h-5 w-5" />}
      label={label}
      runtimeError={runtimeError}
    />
  );
});

ConcatNode.displayName = "ConcatNode";
