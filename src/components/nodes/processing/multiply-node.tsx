import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { X } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type MultiplyNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
};

export const MultiplyNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Multiplicar",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
  } = (data ?? {}) as MultiplyNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Multiplicar",
    executionTarget,
    transport,
    controllerId,
  });

  return (
    <>
      <ProcessingRectNodeShell
        nodeType="multiply"
        icon={<X className="h-6 w-6" />}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConfigClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

MultiplyNode.displayName = "MultiplyNode";
