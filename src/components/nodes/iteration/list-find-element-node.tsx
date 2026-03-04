import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { Search } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ListFindElementNodeData = {
  label?: string;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ListFindElementNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Buscar elemento",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ListFindElementNodeData;

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
        nodeType="listFindElement"
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

ListFindElementNode.displayName = "ListFindElementNode";
