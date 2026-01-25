import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowUp } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type CeilingNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
};

export const CeilingNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Techo",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
  } = (data ?? {}) as CeilingNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Techo",
    executionTarget,
    transport,
    controllerId,
  });

  return (
    <>
      <ProcessingRectNodeShell
        nodeType="ceiling"
        icon={<ArrowUp className="h-6 w-6" />}
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

CeilingNode.displayName = "CeilingNode";
