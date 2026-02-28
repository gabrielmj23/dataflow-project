import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowLeft, Plus } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ListPrependNodeData = {
  label?: string;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ListPrependNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Añadir al inicio",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ListPrependNodeData;

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
        nodeType="listPrepend"
        icon={
          <span className="inline-flex items-center gap-0.5">
            <Plus className="h-3.5 w-3.5" />
            <ArrowLeft className="h-3.5 w-3.5" />
          </span>
        }
        label={label}
        subtitle={config.subtitle}
        variant="doubleInSingleOut"
        onConnectClick={config.onConfigClick}
      />
      {config.dialog}
    </>
  );
});

ListPrependNode.displayName = "ListPrependNode";
