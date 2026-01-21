import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Minus } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type SubtractNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit";
  transport?: "serial" | "bluetooth";
};

export const SubtractNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Restar",
    runtimeError,
    executionTarget,
    transport,
  } = (data ?? {}) as SubtractNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Restar",
    executionTarget,
    transport,
  });

  return (
    <>
      <ProcessingRectNodeShell
        nodeType="subtract"
        icon={<Minus className="h-6 w-6" />}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConfigClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

SubtractNode.displayName = "SubtractNode";
