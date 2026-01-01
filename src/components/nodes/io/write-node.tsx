import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { PenSquare } from "lucide-react";

import { IoRectNodeShell } from "@/components/nodes/io/io-rect-node-shell";

export type WriteNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const WriteNode = memo(({ data }: NodeProps) => {
  const { label = "Escribir", runtimeError } = (data ?? {}) as WriteNodeData;

  return (
    <IoRectNodeShell
      icon={<PenSquare className="h-6 w-6" />}
      label={label}
      variant="sink"
      runtimeError={runtimeError}
    />
  );
});

WriteNode.displayName = "WriteNode";
