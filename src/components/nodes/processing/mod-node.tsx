import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Percent } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ModNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
};

export const ModNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Módulo",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
  } = (data ?? {}) as ModNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Módulo",
    executionTarget,
    transport,
    controllerId,
  });

  return (
    <>
      <ProcessingRectNodeShell
        nodeType="mod"
        icon={<Percent className="h-5 w-5" />}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConfigClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

ModNode.displayName = "ModNode";
