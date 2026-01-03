import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Ampersand } from "lucide-react";

import { ControlRectNodeShell } from "@/components/nodes/control/control-rect-node-shell";

export type AndNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const AndNode = memo(({ data }: NodeProps) => {
  const { label = "AND", runtimeError } = (data ?? {}) as AndNodeData;

  return (
    <ControlRectNodeShell
      nodeType="and"
      icon={<Ampersand className="h-6 w-6" />}
      label={label}
      runtimeError={runtimeError}
    />
  );
});

AndNode.displayName = "AndNode";
