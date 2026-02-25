import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Scissors } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ListRemoveFirstNodeData = {
  label?: string;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ListRemoveFirstNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Quitar el primero",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ListRemoveFirstNodeData;

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
        nodeType="listRemoveFirst"
        icon={<Scissors className="h-4 w-4" />}
        label={label}
        subtitle={config.subtitle}
        variant="singleInSingleOut"
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

ListRemoveFirstNode.displayName = "ListRemoveFirstNode";
