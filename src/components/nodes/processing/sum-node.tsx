import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type SumNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit";
  transport?: "serial" | "bluetooth";
};

export const SumNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Sumar",
    runtimeError,
    executionTarget,
    transport,
  } = (data ?? {}) as SumNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Sumar",
    executionTarget,
    transport,
  });

  return (
    <>
      <ProcessingRectNodeShell
        nodeType="sum"
        icon={<Plus className="h-6 w-6" />}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConfigClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

SumNode.displayName = "SumNode";
