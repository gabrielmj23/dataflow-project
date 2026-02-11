import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type AccumulateNodeData = {
  label?: string;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const AccumulateNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Acumular",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as AccumulateNodeData;

  const config = useMicrobitExecutionConfig({
    nodeId: id,
    title: "Configurar ejecucion",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  });

  return (
    <>
      <IterationRectNodeShell
        nodeType="accumulate"
        icon={<span className="text-lg font-bold">Σ</span>}
        label={label}
        subtitle={config.subtitle}
        variant="singleInSingleOut"
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

AccumulateNode.displayName = "AccumulateNode";
