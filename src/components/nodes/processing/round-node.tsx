import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Circle } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type RoundNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
};

export const RoundNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Redondear",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
  } = (data ?? {}) as RoundNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Redondear",
    executionTarget,
    transport,
    controllerId,
  });

  return (
    <>
      <ProcessingRectNodeShell
        nodeType="round"
        icon={<Circle className="h-6 w-6" />}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        inputCount={1}
        onConfigClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

RoundNode.displayName = "RoundNode";
