import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Percent } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";

export type ModNodeData = {
  label?: string;
  runtimeError?: string | null;
};

export const ModNode = memo(({ data }: NodeProps) => {
  const { label = "Módulo", runtimeError } = (data ?? {}) as ModNodeData;

  return (
    <ProcessingRectNodeShell
      nodeType="mod"
      icon={<Percent className="h-5 w-5" />}
      label={label}
      runtimeError={runtimeError}
    />
  );
});

ModNode.displayName = "ModNode";
