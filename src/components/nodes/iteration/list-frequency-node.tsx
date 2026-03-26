import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ChartNoAxesCombined } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ListFrequencyNodeData = {
  label?: string;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ListFrequencyNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Frecuencia",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ListFrequencyNodeData;

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
        nodeType="listFrequency"
        icon={<ChartNoAxesCombined className="h-4 w-4" />}
        label={label}
        subtitle={config.subtitle}
        variant="singleInSingleOut"
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

ListFrequencyNode.displayName = "ListFrequencyNode";
