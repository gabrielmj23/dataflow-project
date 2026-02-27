import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ListChecks } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ListIsEmptyNodeData = {
  label?: string;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ListIsEmptyNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Lista vacía",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ListIsEmptyNodeData;

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
        nodeType="listIsEmpty"
        icon={<ListChecks className="h-4 w-4" />}
        label={label}
        subtitle={config.subtitle}
        variant="singleInSingleOut"
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

ListIsEmptyNode.displayName = "ListIsEmptyNode";
