import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowDown } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type FloorNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const FloorNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Piso",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as FloorNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Piso",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  return (
    <>
      <ProcessingRectNodeShell
        nodeType="floor"
        icon={<ArrowDown className="h-6 w-6" />}
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

FloorNode.displayName = "FloorNode";
