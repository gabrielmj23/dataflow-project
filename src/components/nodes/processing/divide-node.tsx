import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Divide } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type DivideNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
};

export const DivideNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "División",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
  } = (data ?? {}) as DivideNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · División",
    executionTarget,
    transport,
    controllerId,
  });

  return (
    <>
      <ProcessingRectNodeShell
        nodeType="divide"
        icon={<Divide className="h-6 w-6" />}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConfigClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

DivideNode.displayName = "DivideNode";
