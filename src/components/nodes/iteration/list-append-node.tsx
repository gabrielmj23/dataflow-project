import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { ArrowRight, Plus } from "lucide-react";

import { IterationRectNodeShell } from "@/components/nodes/iteration/iteration-rect-node-shell";
import { useMicrobitExecutionConfig } from "@/components/nodes/processing/use-microbit-execution-config";

export type ListAppendNodeData = {
  label?: string;
  executionTarget?: "local" | "microbit" | "controller";
  transport?: "serial" | "bluetooth";
  controllerId?: string;
  controllerName?: string;
};

export const ListAppendNode = memo(({ id, data }: NodeProps) => {
  const {
    label = "Añadir al final",
    executionTarget,
    transport,
    controllerId,
    controllerName,
  } = (data ?? {}) as ListAppendNodeData;

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
        nodeType="listAppend"
        icon={
          <span className="inline-flex items-center gap-0.5">
            <Plus className="h-3.5 w-3.5" />
            <ArrowRight className="h-3.5 w-3.5" />
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

ListAppendNode.displayName = "ListAppendNode";
