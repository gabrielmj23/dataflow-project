import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Link2 } from "lucide-react";

import { ProcessingRectNodeShell } from "@/components/nodes/processing/processing-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ConcatNodeData = {
  label?: string;
  runtimeError?: string | null;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ConcatNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Concatenar",
    runtimeError,
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ConcatNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar · Concatenar",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  return (
    <>
      <ProcessingRectNodeShell
        nodeType="concat"
        icon={<Link2 className="h-5 w-5" />}
        label={label}
        subtitle={config.subtitle}
        runtimeError={runtimeError}
        onConfigClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

ConcatNode.displayName = "ConcatNode";
