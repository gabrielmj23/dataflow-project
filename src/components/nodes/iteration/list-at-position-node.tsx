import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Search } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ListAtPositionNodeData = {
  label?: string;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ListAtPositionNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Elemento en posición",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ListAtPositionNodeData;

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
        nodeType="listAtPosition"
        icon={<Search className="h-4 w-4" />}
        label={label}
        subtitle={config.subtitle}
        variant="doubleInSingleOut"
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

ListAtPositionNode.displayName = "ListAtPositionNode";
