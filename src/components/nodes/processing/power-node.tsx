import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type PowerNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit";
  transport?: "serial" | "bluetooth";
};

export const PowerNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Potencia",
    runtimeError,
    executionTarget,
    transport,
  } = (data ?? {}) as PowerNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Potencia",
    executionTarget,
    transport,
  });

  return (
    <>
      <ProcessingRectNodeShell
        nodeType="power"
        icon={<span className="text-sm font-bold">x²</span>}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConfigClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

PowerNode.displayName = "PowerNode";
